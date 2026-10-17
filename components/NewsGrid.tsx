import { ExternalLink, Newspaper } from "lucide-react";
import { formatTimeAgo } from "@/lib/utils";

const NewsGrid = ({ news }: WatchlistNewsProps) => {
  if (!news || news.length === 0) {
    return (
      <div className="empty-state py-10!">
        <Newspaper className="h-8 w-8 text-gray-500 mb-3" />
        <p className="text-gray-500">No recent news right now. Check back later.</p>
      </div>
    );
  }

  return (
    <div className="watchlist-news">
      {news.map((article) => (
        <a
          key={`${article.id}-${article.url}`}
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="news-item flex flex-col rounded-2xl! transition-all hover:-translate-y-0.5 hover:border-yellow-500/40!"
        >
          <span className="news-tag mb-4! text-teal-400!">{article.related || article.category}</span>
          <h3 className="news-title">{article.headline}</h3>
          <div className="news-meta">
            <span>{article.source}</span>
            <span className="mx-2">•</span>
            <span>{formatTimeAgo(article.datetime)}</span>
          </div>
          {article.summary && <p className="news-summary text-sm!">{article.summary}</p>}
          <span className="news-cta mt-auto pt-2 inline-flex items-center gap-1">
            Read more <ExternalLink className="h-3.5 w-3.5" />
          </span>
        </a>
      ))}
    </div>
  );
};

export default NewsGrid;
