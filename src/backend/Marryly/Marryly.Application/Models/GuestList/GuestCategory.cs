namespace Marryly.Application.Models.GuestList;

public static class GuestCategory
{
    public const string Vendor = "vendor";
    public const string Adult = "adult";
    public const string Child3To10 = "child_3_10";
    public const string ChildOver10 = "child_over_10";
    public const string ChildUnder3 = "child_under_3";

    public static bool IsSupported(string value) =>
        string.Equals(value, Vendor, StringComparison.Ordinal) ||
        string.Equals(value, Adult, StringComparison.Ordinal) ||
        string.Equals(value, Child3To10, StringComparison.Ordinal) ||
        string.Equals(value, ChildOver10, StringComparison.Ordinal) ||
        string.Equals(value, ChildUnder3, StringComparison.Ordinal);
}
