import * as users from './users.js';
import * as bookmarks from './bookmarks.js';
import * as tags from './tags.js';
import * as relations from './relations.js';

export default {
  ...users,
  ...bookmarks,
  ...tags,
  ...relations
}
