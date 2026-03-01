using Marryly.Application.Interfaces;
using Marryly.Application.Models.EventDetails;
using Marryly.Functions.Result;
using Marryly.Infrastructure.Database;
using Marryly.Infrastructure.Serialization;
using Marryly.Infrastructure.Services;
using Microsoft.Azure.Cosmos;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Builder;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Newtonsoft.Json;

var builder = FunctionsApplication.CreateBuilder(args);

builder.ConfigureFunctionsWebApplication();

builder.UseMiddleware<ProblemDetailsMiddleware>();

builder.Services
    .AddApplicationInsightsTelemetryWorkerService()
    .ConfigureFunctionsApplicationInsights();

builder.Services.AddSingleton(sp =>
{
    var configuration = sp.GetRequiredService<IConfiguration>();
    var connectionString = configuration["COSMOS_CONNECTION_STRING"];
    
    if (string.IsNullOrEmpty(connectionString))
    {
        throw new InvalidOperationException("COSMOS_CONNECTION_STRING is not configured");
    }

    var options = new CosmosClientOptions
    {
        Serializer = new CosmosJsonDotNetSerializer(new JsonSerializerSettings
        {
            Converters = new List<JsonConverter>
            {
                new EventDetailConverter()
            }
        })
    };

    return new CosmosClient(connectionString, options);
});

builder.Services.AddSingleton<ICosmosContainerProvider, CosmosContainerProvider>();
builder.Services.AddScoped(typeof(ICosmosDbService<>), typeof(CosmosDbService<>));
builder.Services.AddScoped<IEventDetailsService, EventDetailsService>();

builder.Build().Run();