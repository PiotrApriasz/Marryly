using System.Net;
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

public class AccessAuthFunctions(ILogger<AccessAuthFunctions> logger, IConfiguration configuration, IAuthService authService)
{
    [Function("AdminLogin")]
    public async Task<HttpResponseData> AdminLogin(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "panel/auth/login")]
        HttpRequestData req)
    {
        LoginRequest? request;
        try
        {
            request = await JsonSerializer.DeserializeAsync<LoginRequest>(req.Body, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });
        }
        catch (JsonException)
        {
            return await ApiResponse.ProduceErrorResponse(
                req,
                HttpStatusCode.BadRequest,
                "INVALID_AUTH_PAYLOAD",
                "Invalid login payload",
                "Email and password are required."
            );
        }

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
        var eventId = GetConfiguredEventId();

        if (string.IsNullOrWhiteSpace(adminEmail) ||
            string.IsNullOrWhiteSpace(eventId) ||
            (string.IsNullOrWhiteSpace(adminPasswordHash) && string.IsNullOrWhiteSpace(adminPassword)))
        {
            logger.LogError("Admin auth config is missing. Set EVENT_ID, ADMIN_AUTH_EMAIL and ADMIN_AUTH_PASSWORD_HASH");
            return await ApiResponse.ProduceErrorResponse(
                req,
                HttpStatusCode.InternalServerError,
                "AUTH_CONFIG_INVALID",
                "Auth config invalid",
                "Admin auth configuration is missing."
            );
        }

        if (!authService.MatchesEmail(request.Email, adminEmail) ||
            !authService.MatchesPassword(request.Password, adminPasswordHash, adminPassword))
        {
            return await ApiResponse.ProduceErrorResponse(
                req,
                HttpStatusCode.Unauthorized,
                "INVALID_CREDENTIALS",
                "Unauthorized",
                "Invalid email or password."
            );
        }

        var expiresAt = DateTimeOffset.UtcNow.AddHours(authService.GetAdminSessionHours());
        var tokenContext = new AccessTokenContext
        {
            Subject = adminEmail,
            Email = adminEmail,
            Role = AuthConstants.AdminRole,
            EventId = eventId
        };
        var token = authService.CreateSignedToken(tokenContext, expiresAt);

        return await ApiResponse.ProduceSuccessResponse(req, new
        {
            authenticated = true,
            accessToken = token,
            expiresAt = expiresAt.UtcDateTime,
            eventId,
            user = CreateUserPayload(tokenContext, adminDisplayName)
        });
    }

    [Function("GuestAccessLogin")]
    public async Task<HttpResponseData> GuestAccessLogin(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "auth/access-code")]
        HttpRequestData req)
    {
        AccessCodeLoginRequest? request;
        try
        {
            request = await JsonSerializer.DeserializeAsync<AccessCodeLoginRequest>(req.Body, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });
        }
        catch (JsonException)
        {
            return await ApiResponse.ProduceErrorResponse(
                req,
                HttpStatusCode.BadRequest,
                "INVALID_ACCESS_CODE_PAYLOAD",
                "Invalid access code payload",
                "Access code is required."
            );
        }

        if (request is null || string.IsNullOrWhiteSpace(request.AccessCode))
        {
            return await ApiResponse.ProduceErrorResponse(
                req,
                HttpStatusCode.BadRequest,
                "INVALID_ACCESS_CODE_PAYLOAD",
                "Invalid access code payload",
                "Access code is required."
            );
        }

        var configuredAccessCode = configuration["GUEST_ACCESS_CODE"];
        var eventId = GetConfiguredEventId();
        if (string.IsNullOrWhiteSpace(configuredAccessCode) || string.IsNullOrWhiteSpace(eventId))
        {
            logger.LogError("Guest access config is missing. Set EVENT_ID and GUEST_ACCESS_CODE");
            return await ApiResponse.ProduceErrorResponse(
                req,
                HttpStatusCode.InternalServerError,
                "AUTH_CONFIG_INVALID",
                "Auth config invalid",
                "Guest access configuration is missing."
            );
        }

        if (!authService.MatchesAccessCode(request.AccessCode, configuredAccessCode))
        {
            return await ApiResponse.ProduceErrorResponse(
                req,
                HttpStatusCode.Unauthorized,
                "INVALID_ACCESS_CODE",
                "Unauthorized",
                "Access code is invalid."
            );
        }

        var expiresAt = DateTimeOffset.UtcNow.AddHours(authService.GetGuestSessionHours());
        var tokenContext = new AccessTokenContext
        {
            Subject = $"guest:{Guid.NewGuid():N}",
            Role = AuthConstants.GuestRole,
            EventId = eventId
        };
        var token = authService.CreateSignedToken(tokenContext, expiresAt);
        var guestDisplayName = configuration["GUEST_AUTH_DISPLAY_NAME"] ?? "Gość";

        return await ApiResponse.ProduceSuccessResponse(req, new
        {
            authenticated = true,
            accessToken = token,
            expiresAt = expiresAt.UtcDateTime,
            eventId,
            user = CreateUserPayload(tokenContext, guestDisplayName)
        });
    }

    [Function("AccessSession")]
    public async Task<HttpResponseData> Session(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "auth/session")]
        HttpRequestData req)
    {
        return await GetSessionResponse(req);
    }

    [Function("AccessLogout")]
    public HttpResponseData Logout(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "auth/logout")]
        HttpRequestData req)
    {
        return req.CreateResponse(HttpStatusCode.NoContent);
    }

    private async Task<HttpResponseData> GetSessionResponse(HttpRequestData req)
    {
        var token = authService.ReadAccessToken(req);
        if (string.IsNullOrWhiteSpace(token))
        {
            return await ApiResponse.ProduceErrorResponse(
                req,
                HttpStatusCode.Unauthorized,
                "SESSION_NOT_FOUND",
                "Unauthorized",
                "Access token is missing."
            );
        }

        if (!authService.TryValidateToken(token, out var context))
        {
            return await ApiResponse.ProduceErrorResponse(
                req,
                HttpStatusCode.Unauthorized,
                "SESSION_INVALID",
                "Unauthorized",
                "Session is invalid or expired."
            );
        }

        return await ApiResponse.ProduceSuccessResponse(req, new
        {
            authenticated = true,
            eventId = context.EventId,
            user = CreateUserPayload(context, GetDisplayName(context))
        });
    }

    private string? GetConfiguredEventId()
    {
        var eventId = configuration["EVENT_ID"];
        return string.IsNullOrWhiteSpace(eventId) ? null : eventId.Trim();
    }

    private string GetDisplayName(AccessTokenContext context)
    {
        if (context.IsAdmin)
        {
            return configuration["ADMIN_AUTH_DISPLAY_NAME"] ?? "Para Młoda";
        }

        return configuration["GUEST_AUTH_DISPLAY_NAME"] ?? "Gość";
    }

    private static object CreateUserPayload(AccessTokenContext context, string displayName)
    {
        return new
        {
            id = context.Subject,
            email = context.Email,
            displayName,
            role = context.Role
        };
    }
}
