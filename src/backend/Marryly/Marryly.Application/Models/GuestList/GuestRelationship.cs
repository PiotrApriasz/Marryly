namespace Marryly.Application.Models.GuestList;

public static class GuestRelationship
{
    public const string Primary = "primary";
    public const string Partner = "partner";
    public const string Child = "child";
    public const string Other = "other";

    public static bool IsSupported(string value) =>
        string.Equals(value, Primary, StringComparison.Ordinal) ||
        string.Equals(value, Partner, StringComparison.Ordinal) ||
        string.Equals(value, Child, StringComparison.Ordinal) ||
        string.Equals(value, Other, StringComparison.Ordinal);
}
