using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using Marryly.Application.Constants;
using Marryly.Application.Interfaces;
using Marryly.Application.Models.Auth;
using Marryly.Functions.Result;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Marryly.Functions.Auth;

public class AdminAuthFunctions(ILogger<AdminAuthFunctions> logger, IConfiguration configuration, IAuthService authService)
{
    [Function("AdminLogin")]
    public async Task<HttpResponseData> Login(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "panel/auth/login")]
        HttpRequestData req)
    {
        var request = await JsonSerializer.DeserializeAsync<LoginRequest>(req.Body, new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        });

        if (request is null || string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
        {
            return await ApiResponse.ProduceErrorResponse(
                req,
                HttpStatusCode.BadRequest,
                "INVALID_AUTH_PAYLOAD",
                "Invalid login payload",
                "Email and password are required."
            );
        }

        var adminEmail = configuration["ADMIN_AUTH_EMAIL"];
        var adminPassword = configuration["ADMIN_AUTH_PASSWORD"];
        var adminPasswordHash = configuration["ADMIN_AUTH_PASSWORD_HASH"];
        var adminDisplayName = configuration["ADMIN_AUTH_DISPLAY_NAME"] ?? "Para Młoda";

        if (string.IsNullOrWhiteSpace(adminEmail) ||
            (string.IsNullOrWhiteSpace(adminPasswordHash) && string.IsNullOrWhiteSpace(adminPassword)))
        {
            logger.LogError("Admin auth config is missing. Set ADMIN_AUTH_EMAIL and ADMIN_AUTH_PASSWORD_HASH");
            return await ApiResponse.ProduceErrorResponse(
                req,
                HttpStatusCode.InternalServerError,
                "AUTH_CONFIG_INVALID",
                "Auth config invalid",
                "Admin auth configuration is missing."
            );
        }

        if (!authService.MatchesEmail(request.Email, adminEmail) || !authService.MatchesPassword(request.Password, adminPasswordHash, adminPassword))
        {
            return await ApiResponse.ProduceErrorResponse(
                req,
                HttpStatusCode.Unauthorized,
                "INVALID_CREDENTIALS",
                "Unauthorized",
                "Invalid email or password."
            );
        }

        var sessionHours = authService.GetSessionHours();
        var expiresAt = DateTimeOffset.UtcNow.AddHours(sessionHours);
        var token = authService.CreateSignedToken(adminEmail, expiresAt);
        var selfValidationPassed = authService.TryValidateToken(token, out _, out var selfValidationMessage);

        var response = req.CreateResponse(HttpStatusCode.OK);
        await response.WriteAsJsonAsync(new
        {
            authenticated = true,
            accessToken = token,
            user = new
            {
                id = "bride-groom-admin",
                email = adminEmail,
                displayName = adminDisplayName
            },
            diagnostics = new
            {
                secretFingerprint = authService.GetSecretFingerprint(),
                issuer = authService.GetJwtIssuer(),
                audience = authService.GetJwtAudience(),
                tokenFingerprint = authService.GetTokenFingerprint(token),
                selfValidationPassed,
                selfValidationMessage,
                signingKey = authService.GetNormalizedSecretForDiagnostics(),
                validationKey = authService.GetNormalizedSecretForDiagnostics()
            }
        });
        authService.AppendSessionCookie(response, token, expiresAt);

        return response;
    }

    [Function("AdminSession")]
    public async Task<HttpResponseData> Session(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "panel/auth/session")]
        HttpRequestData req)
    {
        var token = authService.ReadAccessToken(req, AuthConstants.SessionCookieName);
        if (string.IsNullOrWhiteSpace(token))
        {
            return await ApiResponse.ProduceErrorResponse(
                req,
                HttpStatusCode.Unauthorized,
                "SESSION_NOT_FOUND",
                "Unauthorized",
                "Session cookie is missing."
            );
        }

        if (!authService.TryValidateToken(token, out var email, out var diagnosticMessage))
        {
            return await ApiResponse.ProduceErrorResponse(
                req,
                HttpStatusCode.Unauthorized,
                "SESSION_INVALID",
                "Unauthorized",
                BuildJwtDiagnosticMessage(authService, token, diagnosticMessage)
            );
        }

        var adminDisplayName = configuration["ADMIN_AUTH_DISPLAY_NAME"] ?? "Para Młoda";
        return await ApiResponse.ProduceSuccessResponse(req, new
        {
            authenticated = true,
            user = new
            {
                id = "bride-groom-admin",
                email,
                displayName = adminDisplayName
            }
        });
    }

    [Function("AdminLogout")]
    public HttpResponseData Logout(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "panel/auth/logout")]
        HttpRequestData req)
    {
        var response = req.CreateResponse(HttpStatusCode.NoContent);
        authService.AppendExpiredSessionCookie(response);
        return response;
    }

    private static string BuildJwtDiagnosticMessage(IAuthService authService, string token, string? diagnosticMessage)
    {
        var baseMessage = diagnosticMessage ?? "Session is invalid or expired.";
        return $"{baseMessage} [secretFingerprint={authService.GetSecretFingerprint()}, issuer={authService.GetJwtIssuer()}, audience={authService.GetJwtAudience()}, receivedTokenFingerprint={authService.GetTokenFingerprint(token)}, validationKey={authService.GetNormalizedSecretForDiagnostics()}]";
    }
}
