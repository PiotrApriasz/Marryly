using Marryly.Application.Interfaces;
using Marryly.Application.Exceptions;
using Marryly.Application.Models.EventDetails;
using Marryly.Infrastructure.Database;
using Microsoft.Azure.Cosmos;
using System.Net;

namespace Marryly.Infrastructure.Services;

public class EventDetailsService(ICosmosDbService<EventDetail> cosmosDbService) : IEventDetailsService
{
    public async Task<WeddingMenu?> GetMenuAsync(string eventId, CancellationToken ct = default)
    {
        var menuId = $"{eventId}:menu";
        var partitionKey = PartitionKeyResolver.ForEventIdBasedData(eventId);

        var result = await cosmosDbService.GetAsync(menuId, partitionKey, ct);
        return result is WeddingMenu menu ? NormalizeMenu(menu) : null;
    }

    public async Task<WeddingMenu> GetAdminMenuAsync(string eventId, CancellationToken ct = default)
    {
        return await GetMenuAsync(eventId, ct) ?? CreateEmptyMenu(eventId);
    }

    public bool HasPublishedMenu(WeddingMenu? menu)
    {
        return menu is not null && menu.Blocks.Any(block => block.Sections.Any(section => section.Items.Count > 0));
    }

    public async Task<WeddingMenu> SaveMenuAsync(string eventId, SaveWeddingMenuRequest request, CancellationToken ct = default)
    {
        var blocks = request.Blocks ?? [];
        var normalizedBlocks = new List<MenuBlock>(blocks.Count);

        for (var blockIndex = 0; blockIndex < blocks.Count; blockIndex += 1)
        {
            var block = blocks[blockIndex];
            var sections = block.Sections ?? [];
            var normalizedSections = new List<MenuSection>(sections.Count);

            for (var sectionIndex = 0; sectionIndex < sections.Count; sectionIndex += 1)
            {
                var section = sections[sectionIndex];
                var sectionType = NormalizeSectionType(section.SectionType);
                var items = section.Items ?? [];
                var normalizedItems = new List<MenuItem>(items.Count);

                for (var itemIndex = 0; itemIndex < items.Count; itemIndex += 1)
                {
                    var item = items[itemIndex];
                    var itemName = item.Name?.Trim() ?? string.Empty;
                    if (itemName.Length == 0)
                    {
                        continue;
                    }

                    normalizedItems.Add(new MenuItem
                    {
                        Name = itemName,
                        Description = NormalizeOptionalText(item.Description),
                        SortOrder = item.SortOrder ?? itemIndex,
                    });
                }

                normalizedSections.Add(new MenuSection
                {
                    SectionType = sectionType,
                    Name = NormalizeSectionName(section.Name, sectionType),
                    ChoicesCount = NormalizeChoicesCount(section.ChoicesCount),
                    SortOrder = section.SortOrder ?? sectionIndex,
                    Items = normalizedItems,
                });
            }

            normalizedBlocks.Add(new MenuBlock
            {
                Title = NormalizeBlockTitle(block.Title),
                SortOrder = block.SortOrder ?? blockIndex,
                Sections = normalizedSections,
            });
        }

        var menu = NormalizeMenu(new WeddingMenu
        {
            Id = $"{eventId}:menu",
            EventId = eventId,
            Type = "menu",
            Title = NormalizeTitle(request.Title),
            Blocks = normalizedBlocks,
            Sections = null,
        });

        var saved = await cosmosDbService.UpsertAsync(menu, ct);
        return saved is WeddingMenu savedMenu ? NormalizeMenu(savedMenu) : menu;
    }

    public async Task<List<WeddingEvent>> GetEventsAsync(string eventId, CancellationToken ct = default)
    {
        var query = $"SELECT * FROM c WHERE c.eventId = '{eventId}' AND c.type = 'event'";
        var queryOptions = new QueryRequestOptions
        {
            PartitionKey = PartitionKeyResolver.ForEventIdBasedData(eventId)
        };

        var events = new List<WeddingEvent>();
        
        await foreach (var item in cosmosDbService.QueryAsync(query, queryOptions, ct))
        {
            if (item is WeddingEvent weddingEvent)
            {
                events.Add(weddingEvent);
            }
        }

        return events;
    }

    private static WeddingMenu CreateEmptyMenu(string eventId)
    {
        return new WeddingMenu
        {
            Id = $"{eventId}:menu",
            EventId = eventId,
            Type = "menu",
            Title = "Menu weselne",
            Blocks = [],
            Sections = null,
        };
    }

    private static WeddingMenu NormalizeMenu(WeddingMenu menu)
    {
        var sourceBlocks = GetSourceBlocks(menu);

        var normalizedBlocks = sourceBlocks
            .OrderBy(block => block.SortOrder)
            .Select((block, blockIndex) =>
            {
                var normalizedSections = (block.Sections ?? [])
                    .OrderBy(section => section.SortOrder)
                    .Select((section, sectionIndex) =>
                    {
                        var sectionType = WeddingMenuSectionTypes.All.Contains(section.SectionType)
                            ? section.SectionType
                            : WeddingMenuSectionTypes.Inne;

                        return new MenuSection
                        {
                            SectionType = sectionType,
                            Name = NormalizeSectionName(section.Name, sectionType),
                            ChoicesCount = NormalizeChoicesCount(section.ChoicesCount),
                            SortOrder = sectionIndex,
                            Items = (section.Items ?? [])
                                .OrderBy(item => item.SortOrder)
                                .Select((item, itemIndex) => new MenuItem
                                {
                                    Name = item.Name?.Trim() ?? string.Empty,
                                    Description = NormalizeOptionalText(item.Description),
                                    SortOrder = itemIndex,
                                })
                                .Where(item => item.Name.Length > 0)
                                .ToList(),
                        };
                    })
                    .ToList();

                return new MenuBlock
                {
                    Title = NormalizeBlockTitle(block.Title),
                    SortOrder = blockIndex,
                    Sections = normalizedSections,
                };
            })
            .ToList();

        return new WeddingMenu
        {
            Id = menu.Id,
            EventId = menu.EventId,
            Type = menu.Type,
            Title = NormalizeTitle(menu.Title),
            Blocks = normalizedBlocks,
            Sections = null,
        };
    }

    private static List<MenuBlock> GetSourceBlocks(WeddingMenu menu)
    {
        if (menu.Blocks.Count > 0)
        {
            return menu.Blocks;
        }

        var legacySections = menu.Sections ?? [];
        if (legacySections.Count == 0)
        {
            return [];
        }

        return
        [
            new MenuBlock
            {
                Title = NormalizeBlockTitle(menu.Title),
                SortOrder = 0,
                Sections = legacySections,
            }
        ];
    }

    private static string NormalizeSectionType(string? sectionType)
    {
        var normalized = sectionType?.Trim() ?? string.Empty;
        if (normalized.Length == 0)
        {
            return WeddingMenuSectionTypes.Inne;
        }

        if (!WeddingMenuSectionTypes.All.Contains(normalized))
        {
            throw new ApiErrorException(
                HttpStatusCode.BadRequest,
                "INVALID_MENU_SECTION_TYPE",
                "Invalid menu section type",
                $"Menu section type '{normalized}' is not supported.");
        }

        return normalized;
    }

    private static string NormalizeSectionName(string? name, string sectionType)
    {
        var trimmed = name?.Trim() ?? string.Empty;
        return trimmed.Length > 0 ? trimmed : WeddingMenuSectionTypes.GetDefaultName(sectionType);
    }

    private static string NormalizeTitle(string? title)
    {
        var trimmed = title?.Trim() ?? string.Empty;
        return trimmed.Length > 0 ? trimmed : "Menu weselne";
    }

    private static string NormalizeBlockTitle(string? title)
    {
        var trimmed = title?.Trim() ?? string.Empty;
        return trimmed.Length > 0 ? trimmed : "Główne menu weselne";
    }

    private static string? NormalizeOptionalText(string? value)
    {
        var trimmed = value?.Trim() ?? string.Empty;
        return trimmed.Length > 0 ? trimmed : null;
    }

    private static int? NormalizeChoicesCount(int? choicesCount)
    {
        return choicesCount is > 0 ? choicesCount : null;
    }
}
