using Microsoft.Azure.Cosmos;

namespace Marryly.Application.Interfaces;

public interface ICosmosContainerProvider
{
    Container GetContainer(string name);
}