import React, { useState } from 'react';
import { useBookmarks } from '../hooks/useBookmarks';
import BookmarkList from '../components/BookmarkList';
import BookmarkForm from '../components/BookmarkForm';
import SearchBar from '../components/SearchBar';
import { Bookmark, BookmarkData } from '../lib/types';

function HomePage(): JSX.Element {
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [editingBookmark, setEditingBookmark] = useState<Bookmark | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFavorites, setShowFavorites] = useState(false);

  const { bookmarks, isLoading, addBookmark, updateBookmark, deleteBookmark } = useBookmarks({ 
    search: searchTerm, 
    favorites: showFavorites 
  });

  const handleEdit = (bookmark: Bookmark): void => {
    setEditingBookmark(bookmark);
    setIsFormVisible(true);
  };

  const handleDelete = (id: string): void => {
    if (window.confirm('Are you sure you want to delete this bookmark?')) {
      deleteBookmark.mutate(id);
    }
  };

  const handleToggleFavorite = (id: string, isFavorite: boolean): void => {
    const bookmark = bookmarks?.find(b => b.id === id);
    if (bookmark) {
      updateBookmark.mutate({ id, data: { isFavorite } });
    }
  };

  const handleFormSubmit = (data: BookmarkData): void => {
    if (editingBookmark) {
      updateBookmark.mutate({ id: editingBookmark.id, data }, {
        onSuccess: () => {
          setIsFormVisible(false);
          setEditingBookmark(null);
        }
      });
    } else {
      addBookmark.mutate(data, {
        onSuccess: () => {
          setIsFormVisible(false);
        }
      });
    }
  };

  const handleCancelForm = (): void => {
    setIsFormVisible(false);
    setEditingBookmark(null);
  };

  return (
    <div className="space-y-6">
      {!isFormVisible && (
        <button onClick={() => setIsFormVisible(true)} className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600">
          Add New Bookmark
        </button>
      )}
      {isFormVisible && (
        <BookmarkForm
          onSubmit={handleFormSubmit}
          onCancel={handleCancelForm}
          existingBookmark={editingBookmark}
          isLoading={addBookmark.isPending || updateBookmark.isPending}
        />
      )}
      <SearchBar 
        onSearchChange={setSearchTerm}
        onFavoritesToggle={setShowFavorites}
        isFavoritesFiltered={showFavorites}
      />
      {isLoading ? (
        <p>Loading bookmarks...</p>
      ) : ( 
        <BookmarkList 
          bookmarks={bookmarks || []} 
          onEdit={handleEdit} 
          onDelete={handleDelete} 
          onToggleFavorite={handleToggleFavorite} 
        />
      )}
    </div>
  );
}

export default HomePage;
