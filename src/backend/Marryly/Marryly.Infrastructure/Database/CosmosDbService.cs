using System.Net;
using System.Runtime.CompilerServices;
using System.Text.RegularExpressions;
using Marryly.Application.Interfaces;
using Marryly.Application.Models.EventDetails;
using Microsoft.Azure.Cosmos;

namespace Marryly.Infrastructure.Database;

public class CosmosDbService<T> : ICosmosDbService<T>
{
    private readonly ICosmosContainerProvider _provider;
    private readonly string _containerName;

    private readonly Dictionary<Type,string> _containerMap = new()
    {
        { typeof(EventDetail), "EventData" },
    };

    public CosmosDbService(ICosmosContainerProvider provider)
    {
        _provider = provider;
        _containerName = _containerMap.TryGetValue(typeof(T), out var n)
            ? n
            : throw new InvalidOperationException($"No container mapping for {typeof(T).Name}");
    }

    public async Task<T?> GetAsync(string id, PartitionKey pk, CancellationToken ct = default)
    {
        var container = _provider.GetContainer(_containerName);
        try
        {
            var resp = await container.ReadItemAsync<T>(id, pk, cancellationToken: ct);
            return resp.Resource;
        }
        catch (CosmosException ex) when (ex.StatusCode == HttpStatusCode.NotFound)
        {
            return default;
        }
    }

    public async Task<T> AddAsync(T entity, CancellationToken ct = default)
    {
        var container = _provider.GetContainer(_containerName);
        var pk = PartitionKeyResolver.ForEntity(entity!);
        var resp = await container.CreateItemAsync(entity, pk, cancellationToken: ct);
        return resp.Resource;
    }

    public async Task<T> UpsertAsync(T entity, CancellationToken ct = default)
    {
        var container = _provider.GetContainer(_containerName);
        var pk = PartitionKeyResolver.ForEntity(entity!);
        var resp = await container.UpsertItemAsync(entity, pk, cancellationToken: ct);
        return resp.Resource;
    }

    public async Task DeleteAsync(string id, PartitionKey pk, CancellationToken ct = default)
    {
        var container = _provider.GetContainer(_containerName);
        await container.DeleteItemAsync<T>(id, pk, cancellationToken: ct);
    }

    public async IAsyncEnumerable<T> QueryAsync(string? query = null, QueryRequestOptions? opts = null,
        [EnumeratorCancellation] CancellationToken ct = default)
    {
        var container = _provider.GetContainer(_containerName);
        var q = string.IsNullOrWhiteSpace(query) ? "SELECT * FROM c" : query;
        using var iterator = container.GetItemQueryIterator<T>(new QueryDefinition(q), requestOptions: opts);
        while (iterator.HasMoreResults)
        {
            var page = await iterator.ReadNextAsync(ct);
            foreach (var item in page)
                yield return item;
        }
    }

    public async IAsyncEnumerable<T> QueryAsync(QueryDefinition queryDefinition, QueryRequestOptions? opts = null,
        [EnumeratorCancellation] CancellationToken ct = default)
    {
        var container = _provider.GetContainer(_containerName);
        using var iterator = container.GetItemQueryIterator<T>(queryDefinition, requestOptions: opts);
        while (iterator.HasMoreResults)
        {
            var page = await iterator.ReadNextAsync(ct);
            foreach (var item in page)
                yield return item;
        }
    }
}
