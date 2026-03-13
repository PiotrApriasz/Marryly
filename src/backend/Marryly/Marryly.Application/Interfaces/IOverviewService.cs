using Marryly.Application.Models.Overview;

namespace Marryly.Application.Interfaces;

public interface IOverviewService
{
    Task<OverviewResponse> GetOverviewAsync(string eventId, CancellationToken ct = default);
}
