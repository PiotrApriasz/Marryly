namespace Marryly.Application.Models.Media;

public static class SharedGalleryAccess
{
    public const int ShareCodeLength = 10;

    public static bool TryParse(string? value, out IReadOnlyList<string> shareCodes)
    {
        shareCodes = [];
        if (string.IsNullOrWhiteSpace(value))
        {
            return false;
        }

        var codes = value.Split('x', StringSplitOptions.None);
        if (codes.Length == 0 || codes.Any(code => !IsValidShareCode(code)))
        {
            return false;
        }

        var distinctCodes = codes.Distinct(StringComparer.Ordinal).ToList();
        if (distinctCodes.Count != codes.Length)
        {
            return false;
        }

        shareCodes = distinctCodes;
        return true;
    }

    public static bool IsValidShareCode(string? value) =>
        value is { Length: ShareCodeLength } && value.All(character =>
            (character is >= 'a' and <= 'w') ||
            (character is >= 'y' and <= 'z') ||
            (character is >= '0' and <= '9'));
}
