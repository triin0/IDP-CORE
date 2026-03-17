import React from 'react';

interface SearchBarProps {
  onSearchChange: (value: string) => void;
  onFavoritesToggle: (value: boolean) => void;
  isFavoritesFiltered: boolean;
}

function SearchBar({ onSearchChange, onFavoritesToggle, isFavoritesFiltered }: SearchBarProps): JSX.Element {
  return (
    <div className="p-4 bg-white rounded-lg shadow-md mb-6 flex items-center space-x-4">
      <input
        type="text"
        placeholder="Search bookmarks..."
        onChange={(e) => onSearchChange(e.target.value)}
        className="flex-grow block w-full rounded-md border-gray-300 shadow-sm"
      />
      <div className="flex items-center">
        <input
          type="checkbox"
          id="favorites-filter"
          checked={isFavoritesFiltered}
          onChange={(e) => onFavoritesToggle(e.target.checked)}
          className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
        />
        <label htmlFor="favorites-filter" className="ml-2 block text-sm text-gray-900">Favorites only</label>
      </div>
    </div>
  );
}

export default SearchBar;
