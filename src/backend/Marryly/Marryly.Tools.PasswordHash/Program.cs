using Microsoft.AspNetCore.Identity;

if (args.Length > 0 && (args[0] == "-h" || args[0] == "--help"))
{
    Console.WriteLine("Usage:");
    Console.WriteLine("  dotnet run --project Marryly.Tools.PasswordHash -- \"your-password\"");
    Console.WriteLine("  dotnet run --project Marryly.Tools.PasswordHash");
    Console.WriteLine();
    Console.WriteLine("When no password argument is provided, the tool prompts for one.");
    return;
}

var password = args.Length > 0 ? args[0] : PromptForPassword();
if (string.IsNullOrWhiteSpace(password))
{
    Console.Error.WriteLine("Password cannot be empty.");
    Environment.ExitCode = 1;
    return;
}

var hasher = new PasswordHasher<string>();
var hash = hasher.HashPassword(string.Empty, password);
Console.WriteLine(hash);

static string PromptForPassword()
{
    Console.Write("Enter password: ");
    var buffer = new List<char>();

    while (true)
    {
        var key = Console.ReadKey(intercept: true);
        if (key.Key == ConsoleKey.Enter)
        {
            Console.WriteLine();
            break;
        }

        if (key.Key == ConsoleKey.Backspace)
        {
            if (buffer.Count == 0)
            {
                continue;
            }

            buffer.RemoveAt(buffer.Count - 1);
            continue;
        }

        if (!char.IsControl(key.KeyChar))
        {
            buffer.Add(key.KeyChar);
        }
    }

    return new string(buffer.ToArray());
}
