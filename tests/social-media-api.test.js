/**
 * Tests for the social-media-api module
 * Run with: npx jest tests/social-media-api.test.js
 */

// ==========================================
// Mocks
// ==========================================

// Build chainable Supabase mock
function chainable(resolveWith = { data: null, error: null }) {
  const obj = {
    select: jest.fn(() => obj),
    insert: jest.fn(() => obj),
    update: jest.fn(() => obj),
    eq: jest.fn(() => obj),
    lte: jest.fn(() => obj),
    single: jest.fn(() => Promise.resolve(resolveWith)),
    then: (resolve) => resolve(resolveWith),
  };
  return obj;
}

let mockFromResults = [];
let mockFromCallIndex = 0;

const mockFrom = jest.fn(() => {
  if (mockFromResults.length > 0 && mockFromCallIndex < mockFromResults.length) {
    return mockFromResults[mockFromCallIndex++];
  }
  return chainable();
});

jest.mock(
  '@supabase/supabase-js',
  () => ({
    createClient: jest.fn(() => ({
      from: mockFrom,
    })),
  }),
  { virtual: true }
);

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Set env vars
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_KEY = 'test-service-key';

const socialMedia = require('../api/social-media-api');

// ==========================================
// HELPERS
// ==========================================

function mockFetchResponse(ok, data, statusText = 'OK') {
  return {
    ok,
    statusText,
    json: jest.fn().mockResolvedValue(data),
    text: jest.fn().mockResolvedValue(typeof data === 'string' ? data : JSON.stringify(data)),
    arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(8)),
    headers: { get: jest.fn((name) => (name === 'content-type' ? 'image/png' : null)) },
  };
}

// ==========================================
// TESTS
// ==========================================

describe('Social Media API Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFromResults = [];
    mockFromCallIndex = 0;
    // Reset env vars for each test
    delete process.env.TWITTER_BEARER_TOKEN;
    delete process.env.TWITTER_API_KEY;
    delete process.env.TWITTER_API_SECRET;
    delete process.env.TWITTER_ACCESS_TOKEN;
    delete process.env.TWITTER_ACCESS_TOKEN_SECRET;
    delete process.env.LINKEDIN_ACCESS_TOKEN;
    delete process.env.LINKEDIN_ORG_ID;
    delete process.env.FACEBOOK_PAGE_TOKEN;
    delete process.env.FACEBOOK_PAGE_ID;
    delete process.env.INSTAGRAM_ACCOUNT_ID;
  });

  // --- postToTwitter ---

  describe('postToTwitter', () => {
    test('posts a text-only tweet successfully', async () => {
      process.env.TWITTER_API_KEY = 'test-api-key';
      process.env.TWITTER_API_SECRET = 'test-api-secret';
      process.env.TWITTER_ACCESS_TOKEN = 'test-access-token';
      process.env.TWITTER_ACCESS_TOKEN_SECRET = 'test-access-token-secret';

      mockFetch.mockResolvedValueOnce(mockFetchResponse(true, { data: { id: 'tweet-123' } }));

      const result = await socialMedia.postToTwitter('Hello from tests!');

      expect(result.platform).toBe('twitter');
      expect(result.postId).toBe('tweet-123');
      expect(result.url).toBe('https://x.com/i/status/tweet-123');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.twitter.com/2/tweets',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: expect.stringContaining('OAuth'),
          }),
        })
      );
    });

    test('posts a tweet with image', async () => {
      process.env.TWITTER_API_KEY = 'test-api-key';
      process.env.TWITTER_API_SECRET = 'test-api-secret';
      process.env.TWITTER_ACCESS_TOKEN = 'test-access-token';
      process.env.TWITTER_ACCESS_TOKEN_SECRET = 'test-access-token-secret';

      // Image download
      mockFetch.mockResolvedValueOnce(mockFetchResponse(true, {}));
      // Media upload
      mockFetch.mockResolvedValueOnce(mockFetchResponse(true, { media_id_string: 'media-456' }));
      // Tweet post
      mockFetch.mockResolvedValueOnce(mockFetchResponse(true, { data: { id: 'tweet-789' } }));

      const result = await socialMedia.postToTwitter('Tweet with image', 'https://example.com/img.png');

      expect(result.postId).toBe('tweet-789');
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    test('throws when Twitter OAuth credentials are not configured', async () => {
      await expect(socialMedia.postToTwitter('test')).rejects.toThrow('Twitter OAuth 1.0a credentials not configured');
    });

    test('throws when Twitter API returns error', async () => {
      process.env.TWITTER_API_KEY = 'test-api-key';
      process.env.TWITTER_API_SECRET = 'test-api-secret';
      process.env.TWITTER_ACCESS_TOKEN = 'test-access-token';
      process.env.TWITTER_ACCESS_TOKEN_SECRET = 'test-access-token-secret';

      mockFetch.mockResolvedValueOnce(mockFetchResponse(false, { detail: 'Rate limit exceeded' }, 'Too Many Requests'));

      await expect(socialMedia.postToTwitter('test')).rejects.toThrow('Twitter API error: Rate limit exceeded');
    });

    test('throws with statusText when no detail in error', async () => {
      process.env.TWITTER_API_KEY = 'test-api-key';
      process.env.TWITTER_API_SECRET = 'test-api-secret';
      process.env.TWITTER_ACCESS_TOKEN = 'test-access-token';
      process.env.TWITTER_ACCESS_TOKEN_SECRET = 'test-access-token-secret';

      mockFetch.mockResolvedValueOnce(mockFetchResponse(false, {}, 'Forbidden'));

      await expect(socialMedia.postToTwitter('test')).rejects.toThrow('Twitter API error: Forbidden');
    });

    test('throws when media upload fails', async () => {
      process.env.TWITTER_API_KEY = 'test-api-key';
      process.env.TWITTER_API_SECRET = 'test-api-secret';
      process.env.TWITTER_ACCESS_TOKEN = 'test-access-token';
      process.env.TWITTER_ACCESS_TOKEN_SECRET = 'test-access-token-secret';

      // Image download succeeds
      mockFetch.mockResolvedValueOnce(mockFetchResponse(true, {}));
      // Media upload fails
      mockFetch.mockResolvedValueOnce(mockFetchResponse(false, {}, 'Bad Request'));

      await expect(socialMedia.postToTwitter('test', 'https://example.com/img.png')).rejects.toThrow(
        'Failed to upload media to Twitter'
      );
    });
  });

  // --- postToLinkedIn ---

  describe('postToLinkedIn', () => {
    test('posts text content to LinkedIn successfully', async () => {
      process.env.LINKEDIN_ACCESS_TOKEN = 'test-linkedin-token';
      process.env.LINKEDIN_ORG_ID = 'org-12345';

      mockFetch.mockResolvedValueOnce(mockFetchResponse(true, { id: 'urn:li:share:54321' }));

      const result = await socialMedia.postToLinkedIn('LinkedIn post content');

      expect(result.platform).toBe('linkedin');
      expect(result.postId).toBe('urn:li:share:54321');
      expect(result.url).toContain('urn:li:share:54321');
    });

    test('posts content with image to LinkedIn', async () => {
      process.env.LINKEDIN_ACCESS_TOKEN = 'test-linkedin-token';
      process.env.LINKEDIN_ORG_ID = 'org-12345';

      // Register upload
      mockFetch.mockResolvedValueOnce(
        mockFetchResponse(true, {
          value: {
            uploadMechanism: {
              'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest': {
                uploadUrl: 'https://upload.linkedin.com/upload/123',
              },
            },
            asset: 'urn:li:digitalmediaAsset:abc',
          },
        })
      );
      // Download image
      mockFetch.mockResolvedValueOnce(mockFetchResponse(true, {}));
      // Upload image
      mockFetch.mockResolvedValueOnce(mockFetchResponse(true, {}));
      // Post
      mockFetch.mockResolvedValueOnce(mockFetchResponse(true, { id: 'urn:li:share:99999' }));

      const result = await socialMedia.postToLinkedIn('Post with image', 'https://example.com/img.png');

      expect(result.platform).toBe('linkedin');
      expect(result.postId).toBe('urn:li:share:99999');
    });

    test('throws when LinkedIn credentials are not configured', async () => {
      await expect(socialMedia.postToLinkedIn('test')).rejects.toThrow('LinkedIn API credentials not configured');
    });

    test('throws when only access token is set but not org ID', async () => {
      process.env.LINKEDIN_ACCESS_TOKEN = 'test-token';

      await expect(socialMedia.postToLinkedIn('test')).rejects.toThrow('LinkedIn API credentials not configured');
    });

    test('throws when LinkedIn API returns error', async () => {
      process.env.LINKEDIN_ACCESS_TOKEN = 'test-token';
      process.env.LINKEDIN_ORG_ID = 'org-123';

      mockFetch.mockResolvedValueOnce(mockFetchResponse(false, 'Unauthorized', 'Unauthorized'));

      await expect(socialMedia.postToLinkedIn('test')).rejects.toThrow('LinkedIn API error');
    });
  });

  // --- postToFacebook ---

  describe('postToFacebook', () => {
    test('posts text to Facebook feed successfully', async () => {
      process.env.FACEBOOK_PAGE_TOKEN = 'test-fb-token';
      process.env.FACEBOOK_PAGE_ID = 'page-123';

      mockFetch.mockResolvedValueOnce(mockFetchResponse(true, { id: 'fb-post-456' }));

      const result = await socialMedia.postToFacebook('Facebook post!');

      expect(result.platform).toBe('facebook');
      expect(result.postId).toBe('fb-post-456');
      expect(result.url).toBe('https://facebook.com/fb-post-456');

      // Should use feed endpoint
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/feed'), expect.any(Object));
    });

    test('posts photo to Facebook when imageUrl provided', async () => {
      process.env.FACEBOOK_PAGE_TOKEN = 'test-fb-token';
      process.env.FACEBOOK_PAGE_ID = 'page-123';

      mockFetch.mockResolvedValueOnce(mockFetchResponse(true, { id: 'fb-photo-789' }));

      const result = await socialMedia.postToFacebook('Photo post', 'https://example.com/photo.jpg');

      expect(result.postId).toBe('fb-photo-789');

      // Should use photos endpoint
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/photos'), expect.any(Object));
    });

    test('throws when Facebook credentials are not configured', async () => {
      await expect(socialMedia.postToFacebook('test')).rejects.toThrow('Facebook API credentials not configured');
    });

    test('throws when only page token is set', async () => {
      process.env.FACEBOOK_PAGE_TOKEN = 'test-token';

      await expect(socialMedia.postToFacebook('test')).rejects.toThrow('Facebook API credentials not configured');
    });

    test('throws when Facebook API returns error', async () => {
      process.env.FACEBOOK_PAGE_TOKEN = 'test-token';
      process.env.FACEBOOK_PAGE_ID = 'page-123';

      mockFetch.mockResolvedValueOnce(mockFetchResponse(false, { error: { message: 'Invalid token' } }, 'Bad Request'));

      await expect(socialMedia.postToFacebook('test')).rejects.toThrow('Facebook API error: Invalid token');
    });

    test('uses statusText when no error message in response', async () => {
      process.env.FACEBOOK_PAGE_TOKEN = 'test-token';
      process.env.FACEBOOK_PAGE_ID = 'page-123';

      mockFetch.mockResolvedValueOnce(mockFetchResponse(false, { error: {} }, 'Forbidden'));

      await expect(socialMedia.postToFacebook('test')).rejects.toThrow('Facebook API error: Forbidden');
    });
  });

  // --- postToInstagram ---

  describe('postToInstagram', () => {
    test('posts image to Instagram successfully', async () => {
      process.env.FACEBOOK_PAGE_TOKEN = 'test-fb-token';
      process.env.INSTAGRAM_ACCOUNT_ID = 'ig-123';

      // Create media container
      mockFetch.mockResolvedValueOnce(mockFetchResponse(true, { id: 'container-456' }));
      // Publish media container
      mockFetch.mockResolvedValueOnce(mockFetchResponse(true, { id: 'ig-post-789' }));

      const result = await socialMedia.postToInstagram('Instagram caption', 'https://example.com/photo.jpg');

      expect(result.platform).toBe('instagram');
      expect(result.postId).toBe('ig-post-789');
      expect(result.url).toBe('https://instagram.com/p/ig-post-789');
    });

    test('throws when Instagram credentials are not configured', async () => {
      await expect(socialMedia.postToInstagram('test', 'https://img.com/a.jpg')).rejects.toThrow(
        'Instagram API credentials not configured'
      );
    });

    test('throws when only page token is set but not account ID', async () => {
      process.env.FACEBOOK_PAGE_TOKEN = 'test-token';

      await expect(socialMedia.postToInstagram('test', 'https://img.com/a.jpg')).rejects.toThrow(
        'Instagram API credentials not configured'
      );
    });

    test('throws when no image URL is provided', async () => {
      process.env.FACEBOOK_PAGE_TOKEN = 'test-token';
      process.env.INSTAGRAM_ACCOUNT_ID = 'ig-123';

      await expect(socialMedia.postToInstagram('test', null)).rejects.toThrow('Instagram requires an image');
    });

    test('throws when container creation fails', async () => {
      process.env.FACEBOOK_PAGE_TOKEN = 'test-token';
      process.env.INSTAGRAM_ACCOUNT_ID = 'ig-123';

      mockFetch.mockResolvedValueOnce(mockFetchResponse(false, { error: { message: 'Invalid image' } }, 'Bad Request'));

      await expect(socialMedia.postToInstagram('test', 'https://example.com/img.jpg')).rejects.toThrow(
        'Instagram API error: Invalid image'
      );
    });

    test('throws when publish step fails', async () => {
      process.env.FACEBOOK_PAGE_TOKEN = 'test-token';
      process.env.INSTAGRAM_ACCOUNT_ID = 'ig-123';

      // Container creation succeeds
      mockFetch.mockResolvedValueOnce(mockFetchResponse(true, { id: 'container-1' }));
      // Publish fails
      mockFetch.mockResolvedValueOnce(
        mockFetchResponse(false, { error: { message: 'Publish failed' } }, 'Server Error')
      );

      await expect(socialMedia.postToInstagram('test', 'https://example.com/img.jpg')).rejects.toThrow(
        'Instagram publish error: Publish failed'
      );
    });
  });

  // --- publishToSocialMedia ---

  describe('publishToSocialMedia', () => {
    test('publishes to all configured platforms', async () => {
      process.env.TWITTER_API_KEY = 'test-api-key';
      process.env.TWITTER_API_SECRET = 'test-api-secret';
      process.env.TWITTER_ACCESS_TOKEN = 'test-access-token';
      process.env.TWITTER_ACCESS_TOKEN_SECRET = 'test-access-token-secret';
      process.env.LINKEDIN_ACCESS_TOKEN = 'test-linkedin';
      process.env.LINKEDIN_ORG_ID = 'org-1';
      process.env.FACEBOOK_PAGE_TOKEN = 'test-fb';
      process.env.FACEBOOK_PAGE_ID = 'page-1';

      const post = {
        id: 'post-1',
        content: 'Multi-platform post',
        platforms: ['twitter', 'facebook'],
        platform_content: null,
        image_url: null,
      };

      // Fetch post from DB
      mockFromResults.push(chainable({ data: post, error: null }));
      // Update post with results
      mockFromResults.push(chainable({ data: null, error: null }));

      // Twitter API
      mockFetch.mockResolvedValueOnce(mockFetchResponse(true, { data: { id: 'tw-1' } }));
      // Facebook API
      mockFetch.mockResolvedValueOnce(mockFetchResponse(true, { id: 'fb-1' }));

      const result = await socialMedia.publishToSocialMedia('post-1');

      expect(result.results).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
      expect(result.status).toBe('published');
    });

    test('uses platform-specific content when available', async () => {
      process.env.TWITTER_API_KEY = 'test-api-key';
      process.env.TWITTER_API_SECRET = 'test-api-secret';
      process.env.TWITTER_ACCESS_TOKEN = 'test-access-token';
      process.env.TWITTER_ACCESS_TOKEN_SECRET = 'test-access-token-secret';

      const post = {
        id: 'post-2',
        content: 'Default content',
        platforms: ['twitter'],
        platform_content: { twitter: 'Custom tweet content' },
        image_url: null,
      };

      mockFromResults.push(chainable({ data: post, error: null }));
      mockFromResults.push(chainable({ data: null, error: null }));

      mockFetch.mockResolvedValueOnce(mockFetchResponse(true, { data: { id: 'tw-2' } }));

      const result = await socialMedia.publishToSocialMedia('post-2');

      expect(result.status).toBe('published');
      // Verify custom content was used
      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.text).toBe('Custom tweet content');
    });

    test('returns partial status when some platforms fail', async () => {
      process.env.TWITTER_API_KEY = 'test-api-key';
      process.env.TWITTER_API_SECRET = 'test-api-secret';
      process.env.TWITTER_ACCESS_TOKEN = 'test-access-token';
      process.env.TWITTER_ACCESS_TOKEN_SECRET = 'test-access-token-secret';
      process.env.FACEBOOK_PAGE_TOKEN = 'test-fb';
      process.env.FACEBOOK_PAGE_ID = 'page-1';

      const post = {
        id: 'post-3',
        content: 'Partial post',
        platforms: ['twitter', 'facebook'],
        platform_content: null,
        image_url: null,
      };

      mockFromResults.push(chainable({ data: post, error: null }));
      mockFromResults.push(chainable({ data: null, error: null }));

      // Twitter succeeds
      mockFetch.mockResolvedValueOnce(mockFetchResponse(true, { data: { id: 'tw-3' } }));
      // Facebook fails
      mockFetch.mockResolvedValueOnce(mockFetchResponse(false, { error: { message: 'Auth failed' } }, 'Unauthorized'));

      const result = await socialMedia.publishToSocialMedia('post-3');

      expect(result.results).toHaveLength(1);
      expect(result.errors).toHaveLength(1);
      expect(result.status).toBe('partial');
    });

    test('returns failed status when all platforms fail', async () => {
      // No platform tokens set
      const post = {
        id: 'post-4',
        content: 'Failed post',
        platforms: ['twitter', 'linkedin'],
        platform_content: null,
        image_url: null,
      };

      mockFromResults.push(chainable({ data: post, error: null }));
      mockFromResults.push(chainable({ data: null, error: null }));

      const result = await socialMedia.publishToSocialMedia('post-4');

      expect(result.results).toHaveLength(0);
      expect(result.errors).toHaveLength(2);
      expect(result.status).toBe('failed');
    });

    test('throws when post not found', async () => {
      mockFromResults.push(chainable({ data: null, error: new Error('Not found') }));

      await expect(socialMedia.publishToSocialMedia('bad-id')).rejects.toThrow('Post not found');
    });

    test('handles unsupported platform', async () => {
      const post = {
        id: 'post-5',
        content: 'Test',
        platforms: ['tiktok'],
        platform_content: null,
        image_url: null,
      };

      mockFromResults.push(chainable({ data: post, error: null }));
      mockFromResults.push(chainable({ data: null, error: null }));

      const result = await socialMedia.publishToSocialMedia('post-5');

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toContain('Unsupported platform: tiktok');
      expect(result.status).toBe('failed');
    });

    test('publishes to Instagram platform', async () => {
      process.env.FACEBOOK_PAGE_TOKEN = 'test-token';
      process.env.INSTAGRAM_ACCOUNT_ID = 'ig-123';

      const post = {
        id: 'post-6',
        content: 'IG post',
        platforms: ['instagram'],
        platform_content: null,
        image_url: 'https://example.com/photo.jpg',
      };

      mockFromResults.push(chainable({ data: post, error: null }));
      mockFromResults.push(chainable({ data: null, error: null }));

      // Container creation
      mockFetch.mockResolvedValueOnce(mockFetchResponse(true, { id: 'container-1' }));
      // Publish
      mockFetch.mockResolvedValueOnce(mockFetchResponse(true, { id: 'ig-post-1' }));

      const result = await socialMedia.publishToSocialMedia('post-6');

      expect(result.status).toBe('published');
      expect(result.results[0].platform).toBe('instagram');
    });

    test('publishes to LinkedIn platform', async () => {
      process.env.LINKEDIN_ACCESS_TOKEN = 'test-linkedin';
      process.env.LINKEDIN_ORG_ID = 'org-1';

      const post = {
        id: 'post-7',
        content: 'LinkedIn post',
        platforms: ['linkedin'],
        platform_content: null,
        image_url: null,
      };

      mockFromResults.push(chainable({ data: post, error: null }));
      mockFromResults.push(chainable({ data: null, error: null }));

      mockFetch.mockResolvedValueOnce(mockFetchResponse(true, { id: 'urn:li:share:12345' }));

      const result = await socialMedia.publishToSocialMedia('post-7');

      expect(result.status).toBe('published');
      expect(result.results[0].platform).toBe('linkedin');
    });
  });

  // --- processScheduledPosts ---

  describe('processScheduledPosts', () => {
    test('processes scheduled posts that are due', async () => {
      process.env.TWITTER_API_KEY = 'test-api-key';
      process.env.TWITTER_API_SECRET = 'test-api-secret';
      process.env.TWITTER_ACCESS_TOKEN = 'test-access-token';
      process.env.TWITTER_ACCESS_TOKEN_SECRET = 'test-access-token-secret';

      const posts = [{ id: 'sched-1' }, { id: 'sched-2' }];

      // Fetch scheduled posts
      mockFromResults.push(chainable({ data: posts, error: null }));

      // For each post: fetch post + update post
      // Post 1
      mockFromResults.push(
        chainable({
          data: {
            id: 'sched-1',
            content: 'Scheduled 1',
            platforms: ['twitter'],
            platform_content: null,
            image_url: null,
          },
          error: null,
        })
      );
      mockFromResults.push(chainable({ data: null, error: null }));

      // Post 2
      mockFromResults.push(
        chainable({
          data: {
            id: 'sched-2',
            content: 'Scheduled 2',
            platforms: ['twitter'],
            platform_content: null,
            image_url: null,
          },
          error: null,
        })
      );
      mockFromResults.push(chainable({ data: null, error: null }));

      // Twitter API calls
      mockFetch.mockResolvedValueOnce(mockFetchResponse(true, { data: { id: 'tw-s1' } }));
      mockFetch.mockResolvedValueOnce(mockFetchResponse(true, { data: { id: 'tw-s2' } }));

      const result = await socialMedia.processScheduledPosts();

      expect(result.processed).toBe(2);
    });

    test('returns 0 processed when no scheduled posts', async () => {
      mockFromResults.push(chainable({ data: [], error: null }));

      const result = await socialMedia.processScheduledPosts();

      expect(result.processed).toBe(0);
    });

    test('returns 0 processed when query returns error', async () => {
      mockFromResults.push(chainable({ data: null, error: new Error('DB error') }));

      const result = await socialMedia.processScheduledPosts();

      expect(result.processed).toBe(0);
    });

    test('returns 0 processed when query returns null posts', async () => {
      mockFromResults.push(chainable({ data: null, error: null }));

      const result = await socialMedia.processScheduledPosts();

      expect(result.processed).toBe(0);
    });

    test('handles individual post processing failure', async () => {
      const posts = [{ id: 'sched-fail' }];

      // Fetch scheduled posts
      mockFromResults.push(chainable({ data: posts, error: null }));
      // Fetch individual post - not found
      mockFromResults.push(chainable({ data: null, error: new Error('Not found') }));

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const result = await socialMedia.processScheduledPosts();

      expect(result.processed).toBe(0);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to process scheduled post sched-fail'),
        expect.any(String)
      );
      consoleErrorSpy.mockRestore();
    });
  });
});
