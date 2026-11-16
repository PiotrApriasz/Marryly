using System.Net;
using Microsoft.AspNetCore.Http;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;

namespace Marryly.Functions.Result;

public static class ApiResponse
{
    public static async Task<HttpResponseData> ProduceErrorResponse(HttpRequestData req, HttpStatusCode status,
        string code, string title, string detail)
    {
        var res = CreateErrorResponse(req, status);

        var body = new
        {
            type = $"https://httpstatuses.com/{(int)status}",
            title,
            status = (int)status,
            detail,
            code
        };

        await res.WriteAsJsonAsync(body, "application/problem+json");
        return res;
    }

    internal static HttpResponseData CreateErrorResponse(HttpRequestData req, HttpStatusCode status)
    {
        // With ASP.NET integration CreateResponse reuses the same HTTP response.
        // Remove download headers before serializing a problem response.
        req.FunctionContext.GetHttpContext()?.Response.Clear();
        return req.CreateResponse(status);
    }
    
    public static async Task<HttpResponseData> ProduceSuccessResponse<T>(HttpRequestData req, T data)
    {
        var res = req.CreateResponse(HttpStatusCode.OK);
        await res.WriteAsJsonAsync(data);
        return res;
    }
}
