using Microsoft.Azure.Cosmos;

namespace Marryly.Application.Interfaces;

public interface ICosmosDbService<T>
{
    Task<T?> GetAsync(string id, PartitionKey pk, CancellationToken ct = default);
    Task<T> AddAsync(T entity, CancellationToken ct = default);
    Task<T> UpsertAsync(T entity, CancellationToken ct = default);
    Task DeleteAsync(string id, PartitionKey pk, CancellationToken ct = default);
    IAsyncEnumerable<T> QueryAsync(string? query = null, QueryRequestOptions? opts = null, CancellationToken ct = default);
}