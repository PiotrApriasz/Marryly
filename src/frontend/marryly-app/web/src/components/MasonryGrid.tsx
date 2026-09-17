import { useEffect, useMemo, useState, type ReactNode } from 'react';

interface MasonryGridProps<T> {
    items: T[];
    getItemId: (item: T) => string;
    getItemHeightRatio: (item: T) => number;
    renderItem: (item: T) => ReactNode;
}

interface MasonryLayout {
    columnItemIds: string[][];
}

function getColumnCount(): number {
    return typeof window !== 'undefined' && window.innerWidth >= 1024 ? 3 : 2;
}

export default function MasonryGrid<T>({
    items,
    getItemId,
    getItemHeightRatio,
    renderItem,
}: MasonryGridProps<T>) {
    const [columnCount, setColumnCount] = useState(getColumnCount);

    useEffect(() => {
        const handleResize = () => {
            setColumnCount(getColumnCount());
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const layout = useMemo<MasonryLayout>(() => {
        const columnItemIds = Array.from({ length: columnCount }, () => [] as string[]);
        const columnHeights = Array.from({ length: columnCount }, () => 0);

        items.forEach((item) => {
            const assignedColumn = columnHeights.indexOf(Math.min(...columnHeights));
            columnItemIds[assignedColumn]?.push(getItemId(item));
            columnHeights[assignedColumn] = (columnHeights[assignedColumn] ?? 0) + getItemHeightRatio(item) + 1;
        });

        return {
            columnItemIds,
        };
    }, [columnCount, getItemHeightRatio, getItemId, items]);

    const columns = useMemo(() => {
        const itemsById = new Map(items.map((item) => [getItemId(item), item]));
        return layout.columnItemIds.map((column) => column
            .map((id) => itemsById.get(id))
            .filter((item): item is T => item !== undefined));
    }, [getItemId, items, layout]);

    return (
        <div className="masonry-grid">
            {columns.map((column, columnIndex) => (
                <div key={columnIndex} className="masonry-grid-column">
                    {column.map((item) => (
                        <div key={getItemId(item)} className="masonry-grid-item">
                            {renderItem(item)}
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
}
