import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import { Bookmark, BookmarkData } from '../lib/types';

interface BookmarksQueryOptions {
    search?: string;
    tag?: string;
    favorites?: boolean;
}

async function fetchBookmarks(options: BookmarksQueryOptions): Promise<Bookmark[]> {
    const params = new URLSearchParams();
    if (options.search) params.append('search', options.search);
    if (options.tag) params.append('tag', options.tag);
    if (options.favorites) params.append('favorites', 'true');

    const { data } = await apiClient.get(`/bookmarks?${params.toString()}`);
    return data;
}

async function createBookmark(data: BookmarkData): Promise<Bookmark> {
    const response = await apiClient.post('/bookmarks', data);
    return response.data;
}

async function updateBookmark({ id, data }: { id: string; data: Partial<BookmarkData> }): Promise<Bookmark> {
    const response = await apiClient.put(`/bookmarks/${id}`, data);
    return response.data;
}

async function deleteBookmark(id: string): Promise<void> {
    await apiClient.delete(`/bookmarks/${id}`);
}

export function useBookmarks(options: BookmarksQueryOptions = {}) {
    const queryClient = useQueryClient();
    const queryKey = ['bookmarks', options];

    const { data: bookmarks, isLoading, isError, error } = useQuery<Bookmark[], Error>({ 
        queryKey, 
        queryFn: () => fetchBookmarks(options) 
    });

    const addBookmark = useMutation<Bookmark, Error, BookmarkData>({ 
        mutationFn: createBookmark, 
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
        }
    });

    const updateBookmarkMutation = useMutation<Bookmark, Error, { id: string; data: Partial<BookmarkData> }>({ 
        mutationFn: updateBookmark,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
        }
    });

    const deleteBookmarkMutation = useMutation<void, Error, string>({ 
        mutationFn: deleteBookmark, 
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
        }
    });

    return {
        bookmarks,
        isLoading,
        isError,
        error,
        addBookmark,
        updateBookmark: updateBookmarkMutation,
        deleteBookmark: deleteBookmarkMutation,
    };
}
