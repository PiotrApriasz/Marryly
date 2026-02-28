using Marryly.Application.Interfaces;
using Microsoft.Azure.Cosmos;
using Microsoft.Extensions.Configuration;

namespace Marryly.Infrastructure.Database;

public class CosmosContainerProvider(CosmosClient client, IConfiguration configuration) : ICosmosContainerProvider
{
    private Microsoft.Azure.Cosmos.Database? _db;

    public Container GetContainer(string name)
    {
        if (_db is null)
            InitDatabase();
        return _db!.GetContainer(name);
    }

    private void InitDatabase()
    {
        var databaseName = configuration["COSMOS_DATABASE_NAME"] ?? "marryly";
        
        if (_db != null) return;
        _db = client.GetDatabase(databaseName);
    }
}