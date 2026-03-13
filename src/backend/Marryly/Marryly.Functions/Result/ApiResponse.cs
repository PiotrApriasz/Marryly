using System.Net;
using Microsoft.Azure.Functions.Worker.Http;

namespace Marryly.Functions.Result;

public static class ApiResponse
{
    public static async Task<HttpResponseData> ProduceErrorResponse(HttpRequestData req, HttpStatusCode status,
        string code, string title, string detail)
    {
        var res = req.CreateResponse(status);

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
    
    public static async Task<HttpResponseData> ProduceSuccessResponse<T>(HttpRequestData req, T data)
    {
        var res = req.CreateResponse(HttpStatusCode.OK);
        await res.WriteAsJsonAsync(data);
        return res;
    }
}
