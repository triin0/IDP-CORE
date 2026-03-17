import React, { useState, useEffect } from 'react';
import { Bookmark, BookmarkData } from '../lib/types';
import TagInput from './TagInput';

interface BookmarkFormProps {
  onSubmit: (data: BookmarkData) => void;
  onCancel: () => void;
  existingBookmark?: Bookmark | null;
  isLoading: boolean;
}

const initialState: BookmarkData = {
  url: '',
  title: '',
  description: '',
  tags: [],
  isFavorite: false,
};

function BookmarkForm({ onSubmit, onCancel, existingBookmark, isLoading }: BookmarkFormProps): JSX.Element {
  const [formData, setFormData] = useState<BookmarkData>(initialState);

  useEffect(() => {
    if (existingBookmark) {
      setFormData({
        url: existingBookmark.url,
        title: existingBookmark.title || '',
        description: existingBookmark.description || '',
        tags: existingBookmark.tags || [],
        isFavorite: existingBookmark.isFavorite,
      });
    } else {
      setFormData(initialState);
    }
  }, [existingBookmark]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleTagsChange = (tags: string[]): void => {
    setFormData(prev => ({ ...prev, tags }));
  };

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 bg-white rounded-lg shadow-md space-y-4">
      <h2 className="text-xl font-bold">{existingBookmark ? 'Edit Bookmark' : 'Add Bookmark'}</h2>
      <div>
        <label htmlFor="url" className="block text-sm font-medium text-gray-700">URL</label>
        <input type="url" name="url" id="url" value={formData.url} onChange={handleChange} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
      </div>
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-700">Title</label>
        <input type="text" name="title" id="title" value={formData.title} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
      </div>
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description</label>
        <textarea name="description" id="description" value={formData.description} onChange={handleChange} rows={3} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
      </div>
      <div>
        <label htmlFor="tags" className="block text-sm font-medium text-gray-700">Tags</label>
        <TagInput tags={formData.tags} onChange={handleTagsChange} />
      </div>
      <div className="flex items-center">
        <input type="checkbox" name="isFavorite" id="isFavorite" checked={formData.isFavorite} onChange={handleChange} className="h-4 w-4 text-indigo-600 border-gray-300 rounded" />
        <label htmlFor="isFavorite" className="ml-2 block text-sm text-gray-900">Favorite</label>
      </div>
      <div className="flex justify-end space-x-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300">Cancel</button>
        <button type="submit" disabled={isLoading} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300">{isLoading ? 'Saving...' : 'Save'}</button>
      </div>
    </form>
  );
}

export default BookmarkForm;
