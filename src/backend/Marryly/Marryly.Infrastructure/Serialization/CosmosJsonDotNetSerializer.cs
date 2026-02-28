using Microsoft.Azure.Cosmos;
using Newtonsoft.Json;
using System.Text;

namespace Marryly.Infrastructure.Serialization;

public class CosmosJsonDotNetSerializer(JsonSerializerSettings? settings = null) : CosmosSerializer
{
    private readonly JsonSerializer _serializer = JsonSerializer.Create(settings ?? new JsonSerializerSettings());

    public override T FromStream<T>(Stream stream)
    {
        using var sr = new StreamReader(stream);
        using var jsonTextReader = new JsonTextReader(sr);
        return _serializer.Deserialize<T>(jsonTextReader)!;
    }

    public override Stream ToStream<T>(T input)
    {
        var stream = new MemoryStream();
        using (var sw = new StreamWriter(stream, new UTF8Encoding(false, true), 1024, true))
        using (var jsonWriter = new JsonTextWriter(sw))
        {
            _serializer.Serialize(jsonWriter, input);
            jsonWriter.Flush();
        }

        stream.Position = 0;
        return stream;
    }
}
