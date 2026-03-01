using System.Net;
using System.Text.Json;
using Microsoft.Azure.Functions.Worker.Http;

namespace Marryly.Functions.Result;

public static class ApiResponse
{
    public static async Task<HttpResponseData> ProduceErrorResponse(HttpRequestData req, HttpStatusCode status,
        string code, string title, string detail)
    {
        var res = req.CreateResponse(status);
        res.Headers.Add("Content-Type", "application/problem+json");

        var body = new
        {
            type = $"https://httpstatuses.com/{(int)status}",
            title,
            status = (int)status,
            detail,
            code
        };

        await res.WriteStringAsync(JsonSerializer.Serialize(body));
        return res;
    }
    
    public static async Task<HttpResponseData> ProduceSuccessResponse<T>(HttpRequestData req, T data)
    {
        var res = req.CreateResponse(HttpStatusCode.OK);
        res.Headers.Add("Content-Type", "application/json");
        await res.WriteAsJsonAsync(data);
        return res;
    }
}