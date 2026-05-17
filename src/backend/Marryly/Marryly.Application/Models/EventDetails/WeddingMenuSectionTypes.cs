namespace Marryly.Application.Models.EventDetails;

public static class WeddingMenuSectionTypes
{
    public const string Przystawka = "przystawka";
    public const string Zupa = "zupa";
    public const string DanieGlowne = "danie_glowne";
    public const string Deser = "deser";
    public const string Kolacja = "kolacja";
    public const string ZimnaPlyta = "zimna_plyta";
    public const string Bufet = "bufet";
    public const string Napoje = "napoje";
    public const string Alkohol = "alkohol";
    public const string SlodkiStol = "slodki_stol";
    public const string Inne = "inne";

    public static readonly IReadOnlySet<string> All = new HashSet<string>(StringComparer.Ordinal)
    {
        Przystawka,
        Zupa,
        DanieGlowne,
        Deser,
        Kolacja,
        ZimnaPlyta,
        Bufet,
        Napoje,
        Alkohol,
        SlodkiStol,
        Inne,
    };

    public static string GetDefaultName(string sectionType) => sectionType switch
    {
        Przystawka => "Przystawka",
        Zupa => "Zupy",
        DanieGlowne => "Danie glowne",
        Deser => "Desery",
        Kolacja => "Kolacja",
        ZimnaPlyta => "Zimna plyta",
        Bufet => "Bufet",
        Napoje => "Napoje",
        Alkohol => "Alkohol",
        SlodkiStol => "Slodki stol",
        _ => "Inne",
    };
}
