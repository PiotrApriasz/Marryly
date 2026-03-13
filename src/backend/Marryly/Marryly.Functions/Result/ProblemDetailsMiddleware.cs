using System.Net;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Azure.Functions.Worker.Middleware;
using Microsoft.Extensions.Logging;

namespace Marryly.Functions.Result;

public class ProblemDetailsMiddleware(ILogger<ProblemDetailsMiddleware> logger) : IFunctionsWorkerMiddleware
{
    public async Task Invoke(FunctionContext context, FunctionExecutionDelegate next)
    {
        try
        {
            await next(context);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unhandled exception");

            var req = await context.GetHttpRequestDataAsync();
            if (req is null) throw; 

            var res = req.CreateResponse(HttpStatusCode.InternalServerError);

            var traceId = context.InvocationId;
            var problem = new
            {
                type = "https://httpstatuses.com/500",
                title = "Internal Server Error",
                status = 500,
                detail = "Unexpected error occurred.",
                traceId,
                code = "UNHANDLED_ERROR",
                message = ex.Message,
                stackTrace = ex.StackTrace
            };

            await res.WriteAsJsonAsync(problem, "application/problem+json");
            context.GetInvocationResult().Value = res;
        }
    }
}
