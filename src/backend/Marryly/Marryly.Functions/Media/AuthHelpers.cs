using System.Net;
using Marryly.Application.Constants;
using Marryly.Application.Interfaces;
using Marryly.Application.Models.Auth;
using Marryly.Functions.Result;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Primitives;

namespace Marryly.Functions.Media;

internal static class AuthHelpers
{
    internal static async Task<(HttpResponseData? Response, AccessTokenContext? Context)> ValidateUserAsync(
        HttpRequestData req,
        IAuthService authService)
    {
        var token = authService.ReadAccessToken(req);
        if (string.IsNullOrWhiteSpace(token))
        {
            var response = await ApiResponse.ProduceErrorResponse(
                req,
                HttpStatusCode.Unauthorized,
                "SESSION_NOT_FOUND",
                "Unauthorized",
                "Access token is missing.");
            return (response, null);
        }

        if (!authService.TryValidateToken(token, out var context))
        {
            var response = await ApiResponse.ProduceErrorResponse(
                req,
                HttpStatusCode.Unauthorized,
                "SESSION_INVALID",
                "Unauthorized",
                "Session is invalid or expired.");
            return (response, null);
        }

        return (null, context);
    }

    internal static async Task<(HttpResponseData? Response, AccessTokenContext? Context)> ValidateAdminAsync(
        HttpRequestData req,
        IAuthService authService)
    {
        var auth = await ValidateUserAsync(req, authService);
        if (auth.Response is not null || auth.Context is null)
        {
            return auth;
        }

        if (!string.Equals(auth.Context.Role, AuthConstants.AdminRole, StringComparison.Ordinal))
        {
            var response = await ApiResponse.ProduceErrorResponse(
                req,
                HttpStatusCode.Forbidden,
                "ACCESS_FORBIDDEN",
                "Forbidden",
                "Admin access is required.");
            return (response, null);
        }

        return auth;
    }

    internal static int ParsePositiveInt(Dictionary<string, StringValues> query, string key, int fallbackValue)
    {
        if (!query.TryGetValue(key, out var value))
        {
            return fallbackValue;
        }

        return int.TryParse(value.ToString(), out var parsedValue) && parsedValue > 0
            ? parsedValue
            : fallbackValue;
    }
}
