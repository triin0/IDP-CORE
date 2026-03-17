import React from 'react';
import { Bookmark } from '../lib/types';

interface BookmarkListProps {
  bookmarks: Bookmark[];
  onEdit: (bookmark: Bookmark) => void;
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string, isFavorite: boolean) => void;
}

function BookmarkList({ bookmarks, onEdit, onDelete, onToggleFavorite }: BookmarkListProps): JSX.Element {
  if (bookmarks.length === 0) {
    return <p className="text-center text-gray-500">No bookmarks found. Add one to get started!</p>;
  }

  return (
    <div className="space-y-4">
      {bookmarks.map((bookmark) => (
        <div key={bookmark.id} className="bg-white p-4 rounded-lg shadow">
          <div className="flex justify-between items-start">
            <div>
              <a href={bookmark.url} target="_blank" rel="noopener noreferrer" className="text-lg font-semibold text-blue-600 hover:underline">
                {bookmark.title || bookmark.url}
              </a>
              <p className="text-sm text-gray-500 break-all">{bookmark.url}</p>
              {bookmark.description && <p className="mt-2 text-gray-700">{bookmark.description}</p>}
              <div className="mt-2 flex flex-wrap gap-2">
                {bookmark.tags?.map((tag) => (
                  <span key={tag} className="px-2 py-1 bg-gray-200 text-gray-800 text-xs font-medium rounded-full">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex items-center space-x-2 flex-shrink-0 ml-4">
              <button onClick={() => onToggleFavorite(bookmark.id, !bookmark.isFavorite)} className={`text-2xl ${bookmark.isFavorite ? 'text-yellow-500' : 'text-gray-400'}`}>
                ★
              </button>
              <button onClick={() => onEdit(bookmark)} className="text-blue-500 hover:text-blue-700">Edit</button>
              <button onClick={() => onDelete(bookmark.id)} className="text-red-500 hover:text-red-700">Delete</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default BookmarkList;
