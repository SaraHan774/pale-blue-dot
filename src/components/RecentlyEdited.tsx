import { Link } from 'react-router-dom';
import { useRecentlyEditedPages } from '@/hooks/usePageSelectors';
import { formatRelativeTime } from '@/lib/timeUtils';
import './RecentlyEdited.css';

interface RecentlyEditedProps {
  excludePageId?: string;
}

export function RecentlyEdited({ excludePageId }: RecentlyEditedProps) {
  const recentPages = useRecentlyEditedPages(5, excludePageId);

  if (recentPages.length === 0) {
    return null;
  }

  return (
    <div className="recently-edited">
      <div className="recently-edited-cards">
        {recentPages.map(page => (
          <Link
            key={page.id}
            to={`/page/${page.id}`}
            className="recently-edited-card"
          >
            <div className="recently-edited-card-title">{page.title}</div>
            <div className="recently-edited-card-time">
              {formatRelativeTime(page.updatedAt)}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
