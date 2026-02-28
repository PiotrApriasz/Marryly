using Marryly.Application.Models.EventDetails;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Marryly.Infrastructure.Serialization;

public class EventDetailConverter : JsonConverter<EventDetail>
{
    public override EventDetail? ReadJson(JsonReader reader, Type objectType, EventDetail? existingValue, bool hasExistingValue, JsonSerializer serializer)
    {
        var jsonObject = JObject.Load(reader);
        var type = jsonObject["type"]?.Value<string>();

        // Utwórz nowy serializer bez tego konwertera, aby uniknąć nieskończonej rekursji
        var settings = new JsonSerializerSettings();
        foreach (var converter in serializer.Converters)
        {
            if (converter.GetType() != typeof(EventDetailConverter))
            {
                settings.Converters.Add(converter);
            }
        }
        
        var innerSerializer = JsonSerializer.Create(settings);

        EventDetail? result = type switch
        {
            "menu" => jsonObject.ToObject<WeddingMenu>(innerSerializer),
            "event" => jsonObject.ToObject<WeddingEvent>(innerSerializer),
            _ => jsonObject.ToObject<EventDetail>(innerSerializer)
        };

        return result;
    }

    public override void WriteJson(JsonWriter writer, EventDetail? value, JsonSerializer serializer)
    {
        // Utwórz nowy serializer bez tego konwertera dla serializacji
        var settings = new JsonSerializerSettings();
        foreach (var converter in serializer.Converters)
        {
            if (converter.GetType() != typeof(EventDetailConverter))
            {
                settings.Converters.Add(converter);
            }
        }
        
        var innerSerializer = JsonSerializer.Create(settings);
        innerSerializer.Serialize(writer, value);
    }
}
