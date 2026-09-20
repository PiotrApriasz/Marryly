import { useEffect, useMemo, useState, type ReactNode } from 'react';

interface MasonryGridProps<T> {
    items: T[];
    getItemId: (item: T) => string;
    getItemHeightRatio: (item: T) => number;
    renderItem: (item: T) => ReactNode;
    layout?: 'columns' | 'masonry';
}

interface MasonryLayout {
    columnItemIds: string[][];
}

function getColumnCount(layout: 'columns' | 'masonry'): number {
    if (typeof window === 'undefined') {
        return 2;
    }

    if (layout === 'masonry') {
        if (window.innerWidth >= 1440) {
            return 4;
        }

        return window.innerWidth >= 768 ? 3 : 2;
    }

    return window.innerWidth >= 1024 ? 3 : 2;
}

export default function MasonryGrid<T>({
    items,
    getItemId,
    getItemHeightRatio,
    renderItem,
    layout = 'columns',
}: MasonryGridProps<T>) {
    const [columnCount, setColumnCount] = useState(() => getColumnCount(layout));

    useEffect(() => {
        const handleResize = () => {
            setColumnCount(getColumnCount(layout));
        };

        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [layout]);

    const masonryLayout = useMemo<MasonryLayout>(() => {
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
        return masonryLayout.columnItemIds.map((column) => column
            .map((id) => itemsById.get(id))
            .filter((item): item is T => item !== undefined));
    }, [getItemId, items, masonryLayout]);

    return (
        <div className={`masonry-grid ${layout === 'masonry' ? 'masonry-grid-shared' : ''}`}>
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
