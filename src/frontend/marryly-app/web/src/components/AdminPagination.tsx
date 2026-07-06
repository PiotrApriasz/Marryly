import { appText } from '../content/appText';
import Button from './Button';

interface AdminPaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
}

export default function AdminPagination({
    currentPage,
    totalPages,
    onPageChange,
}: AdminPaginationProps) {
    if (totalPages <= 1) {
        return null;
    }

    return (
        <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
            <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
            >
                {appText.common.pagination.previous}
            </Button>
            {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                <Button
                    key={page}
                    type="button"
                    variant={page === currentPage ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => onPageChange(page)}
                >
                    {page}
                </Button>
            ))}
            <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
            >
                {appText.common.pagination.next}
            </Button>
        </div>
    );
}
