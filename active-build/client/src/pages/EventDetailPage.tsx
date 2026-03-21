import React from 'react';
import { useParams } from 'react-router-dom';

// This is a simplified example. A real component would be more complex and fetch data.
// The key security fix is how `event.description` is rendered.

const DUMMY_EVENT = {
    id: 1,
    title: "Tech Conference 2024",
    description: `This is a multi-line description.

It can contain text that looks like HTML: <div>Hello</div>
It can also contain malicious scripts: <script>alert('xss')</script>

By rendering this as text, React will escape it and prevent the script from running.`,
    date: new Date().toISOString(),
    location: "Online",
    capacity: 100,
    rsvps: [{ userId: 1, status: 'attending' }]
};

export function EventDetailPage() {
  const { id } = useParams();
  // In a real app, you would fetch the event data based on the id
  // const { data: event, isLoading, error } = useQuery(['event', id], () => fetchEvent(id));

  const event = DUMMY_EVENT; // Using dummy data for demonstration

  if (!event) {
    return <div>Loading...</div>;
  }

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-3xl font-bold mb-2">{event.title}</h1>
      <div className="text-gray-500 mb-4">
        <span>{new Date(event.date).toLocaleDateString()}</span>
        <span className="mx-2">•</span>
        <span>{event.location}</span>
      </div>
      
      {/* 
        SECURITY FIX: Render user-generated content as text.
        React's JSX automatically escapes string content, preventing XSS attacks.
        The `whitespace-pre-wrap` class is used to respect newlines in the description.
        Avoid using `dangerouslySetInnerHTML` unless you are certain the content is sanitized.
      */}
      <div className="prose max-w-none bg-gray-50 p-4 rounded-lg mt-6">
        <p className="whitespace-pre-wrap">{event.description}</p>
      </div>

      <div className="mt-6">
        <h3 className="text-xl font-semibold">RSVP</h3>
        {/* RSVP functionality would go here */}
      </div>
    </div>
  );
}
