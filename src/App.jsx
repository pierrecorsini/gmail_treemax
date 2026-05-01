import { useState, useCallback, lazy, Suspense, useEffect } from 'react';
import { gapi } from 'gapi-script';
import { Loader2, Mail, LogOut, RefreshCw, Trash2, Copy, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

import { Alert, AlertDescription } from '@/components/ui/alert';
const Treemap = lazy(() => import('./Treemap.jsx'));
import SetupGuide from './SetupGuide.jsx';



const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest';
const SCOPES = 'https://www.googleapis.com/auth/gmail.readonly';
const EMAIL_REGEX = /<([^>]+)>/;
const STORAGE_KEY = 'googleClientId';
const GROUP_THRESHOLD_KEY = 'treemapGroupThreshold';
const GROUP_MODE_KEY = 'treemapGroupMode';
const TREEMAP_DATA_KEY = 'treemapData';
const TOTAL_UNREAD_KEY = 'treemapTotalUnread';
const MESSAGE_LIST_PAGE_SIZE = 500;
const MESSAGE_FETCH_CONCURRENCY = 24;
const PROGRESS_UPDATE_INTERVAL = 20;

// Helper to safely parse JSON from localStorage
const loadFromStorage = (key, defaultValue) => {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : defaultValue;
  } catch {
    return defaultValue;
  }
};

// Helper to safely save to localStorage with quota handling
const saveToStorage = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    if (e.name === 'QuotaExceededError') {
      localStorage.removeItem(TREEMAP_DATA_KEY);
      localStorage.removeItem(TOTAL_UNREAD_KEY);
    }
  }
};

const extractEmailAddress = (fromHeaderValue) => {
  if (!fromHeaderValue || typeof fromHeaderValue !== 'string') return null;
  const angleBracketMatch = fromHeaderValue.match(EMAIL_REGEX);
  if (angleBracketMatch?.[1]) return angleBracketMatch[1].trim().toLowerCase();

  const plainEmailMatch = fromHeaderValue.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  if (plainEmailMatch?.[0]) return plainEmailMatch[0].trim().toLowerCase();

  return null;
};

function App() {
  const [clientId, setClientId] = useState(() => localStorage.getItem(STORAGE_KEY) || '');
  const [needsSetup, setNeedsSetup] = useState(() => !localStorage.getItem(STORAGE_KEY));
  const [tokenClient, setTokenClient] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [treemapData, setTreemapData] = useState(() => {
    const saved = loadFromStorage(TREEMAP_DATA_KEY, null);
    if (saved && Array.isArray(saved)) {
      const valid = saved.filter(item => 
        item && 
        typeof item.size === 'number' && 
        Number.isFinite(item.size) && 
        item.size > 0
      );
      return valid.length > 0 ? valid : null;
    }
    return null;
  });
  const [totalUnread, setTotalUnread] = useState(() => {
    const saved = localStorage.getItem(TOTAL_UNREAD_KEY);
    return saved ? parseInt(saved, 10) : 0;
  });
  const [groupThreshold, setGroupThreshold] = useState(() => {
    const saved = localStorage.getItem(GROUP_THRESHOLD_KEY);
    return saved ? parseInt(saved, 10) : 0;
  });
  const [groupMode, setGroupMode] = useState(() => {
    return localStorage.getItem(GROUP_MODE_KEY) || 'regroup';
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadingEmailCount, setLoadingEmailCount] = useState(0);
  const [totalEmailCount, setTotalEmailCount] = useState(0);
  const [selectedTiles, setSelectedTiles] = useState(() => new Set());
  const [copySuccess, setCopySuccess] = useState(false);
  const hasCachedData = treemapData !== null && treemapData.length > 0;

  useEffect(() => {
    if (clientId && !needsSetup) {
      initGapi();
    }
  }, [clientId, needsSetup]);

  const initGapi = useCallback(() => {
    setIsLoading(true);
    setError(null);
    
    function initClient() {
      gapi.client.init({
        discoveryDocs: [DISCOVERY_DOC],
      }).then(() => {
        const client = google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: SCOPES,
          callback: (response) => {
            if (response.access_token) {
              setIsAuthenticated(true);
              fetchUnreadEmails();
            } else {
              const errorMsg = response.error || 'No access token received';
              console.error('OAuth callback error:', errorMsg, response);
              setError('Authentication error: ' + errorMsg);
              setIsLoading(false);
            }
          },
          error_callback: (err) => {
            console.error('OAuth error_callback:', err);
            setError('Authentication error: ' + (err.message || err.error || 'Unknown error'));
            setIsLoading(false);
          }
        });
        setTokenClient(client);
        setIsLoading(false);
      }).catch((err) => {
        console.error('gapi.client.init error:', err);
        setError('Initialization error: ' + err.message);
        setIsLoading(false);
      });
    }

    gapi.load('client', initClient, (err) => {
      console.error('gapi.load error:', err);
      setError('Failed to load Google API client');
      setIsLoading(false);
    });
  }, [clientId]);

  const handleConfigSubmit = useCallback(async (newClientId) => {
    setIsLoading(true);
    setError(null);
    
    const testClientId = newClientId.trim();
    
    return new Promise((resolve) => {
      function testInit() {
        gapi.client.init({
          discoveryDocs: [DISCOVERY_DOC],
        }).then(() => {
          let authResolved = false;
          
          const testClient = google.accounts.oauth2.initTokenClient({
            client_id: testClientId,
            scope: SCOPES,
            callback: (response) => {
              if (authResolved) return;
              authResolved = true;
              if (response.error) {
                console.error('Config OAuth callback error:', response.error);
                setError('Invalid Client ID: ' + response.error);
                setIsLoading(false);
                resolve(false);
              } else if (response.access_token) {
                localStorage.setItem(STORAGE_KEY, testClientId);
                setClientId(testClientId);
                setNeedsSetup(false);
                setTokenClient(testClient);
                setIsAuthenticated(true);
                fetchUnreadEmails();
                resolve(true);
              } else {
                setError('No access token received');
                setIsLoading(false);
                resolve(false);
              }
            },
            error_callback: (err) => {
              if (authResolved) return;
              authResolved = true;
              console.error('Config OAuth error_callback:', err);
              setError('Invalid Client ID: ' + (err.message || err.error || 'Please check your credentials'));
              setIsLoading(false);
              resolve(false);
            }
          });
          
          testClient.requestAccessToken({ prompt: 'consent' });
          
          setTimeout(() => {
            if (!authResolved) {
              authResolved = true;
              setError('Authentication timeout. Please try again.');
              setIsLoading(false);
              resolve(false);
            }
          }, 60000);
        }).catch((err) => {
          console.error('Config gapi.client.init error:', err);
          setError('Initialization error: ' + err.message);
          setIsLoading(false);
          resolve(false);
        });
      }
      
      gapi.load('client', testInit, (err) => {
        console.error('Config gapi.load error:', err);
        setError('Failed to load Google API client');
        setIsLoading(false);
        resolve(false);
      });
    });
  }, []);

  const handleLogin = useCallback(() => {
    if (tokenClient) {
      tokenClient.requestAccessToken();
    }
  }, [tokenClient]);

  const handleLogout = useCallback(() => {
    const token = gapi.client.getToken();
    if (token !== null) {
      google.accounts.oauth2.revoke(token.access_token);
      gapi.client.setToken('');
    }
    setIsAuthenticated(false);
    setTreemapData(null);
    setTotalUnread(0);
    setError(null);
    // Clear cached data on logout
    localStorage.removeItem(TREEMAP_DATA_KEY);
    localStorage.removeItem(TOTAL_UNREAD_KEY);
  }, []);

  const fetchUnreadEmails = useCallback(async () => {
    try {
      setError(null);
      setIsLoading(true);
      setLoadingEmailCount(0);
      setTotalEmailCount(0);
      
      // Fetch all unread emails with pagination
      const allMessages = [];
      let pageToken = null;
      
      do {
        const response = await gapi.client.gmail.users.messages.list({
          'userId': 'me',
          'q': 'is:unread',
          'maxResults': MESSAGE_LIST_PAGE_SIZE,
          'fields': 'messages/id,nextPageToken,resultSizeEstimate',
          'pageToken': pageToken
        });
        
        if (response.result.messages) {
          allMessages.push(...response.result.messages);
        }
        pageToken = response.result.nextPageToken || null;
      } while (pageToken);

      if (allMessages.length > 0) {
        const messages = allMessages;
        setTotalEmailCount(messages.length);
        const senderMap = new Map();
        let processedCount = 0;

        // Helper to fetch with rate limit detection and retry
        const fetchWithRetry = async (messageId, retries = 4) => {
          for (let attempt = 0; attempt < retries; attempt++) {
            try {
              const result = await gapi.client.gmail.users.messages.get({
                'userId': 'me',
                'id': messageId,
                'format': 'metadata',
                'metadataHeaders': ['From'],
                'fields': 'payload/headers'
              });
              return { success: true, data: result };
            } catch (err) {
              const isRateLimit =
                err?.status === 429 ||
                err?.status === 403 ||
                /rate|quota|too many requests/i.test(err?.result?.error?.message || err?.message || '');

              if (isRateLimit) {
                const backoffDelay = Math.min(600 * Math.pow(2, attempt), 8000);
                await new Promise(resolve => setTimeout(resolve, backoffDelay + Math.floor(Math.random() * 150)));
              } else {
                return { success: false, data: null };
              }
            }
          }
          return { success: false, data: null };
        };

        let cursor = 0;
        const workerCount = Math.min(MESSAGE_FETCH_CONCURRENCY, messages.length);

        const workers = Array.from({ length: workerCount }, () => (async () => {
          while (cursor < messages.length) {
            const currentIndex = cursor;
            cursor += 1;
            const message = messages[currentIndex];
            if (!message?.id) {
              processedCount += 1;
              continue;
            }

            const { success, data: msgDetail } = await fetchWithRetry(message.id);
            processedCount += 1;

            if (success && msgDetail?.result?.payload?.headers) {
              const fromHeader = msgDetail.result.payload.headers.find(h => h.name === 'From');
              const email = extractEmailAddress(fromHeader?.value);
              if (email) {
                const atIndex = email.lastIndexOf('@');
                const domain = atIndex > -1 ? email.substring(atIndex + 1) : 'unknown';
                senderMap.set(email, { count: (senderMap.get(email)?.count || 0) + 1, domain });
              }
            }

            if (
              processedCount === messages.length ||
              processedCount % PROGRESS_UPDATE_INTERVAL === 0
            ) {
              setLoadingEmailCount(processedCount);
            }

            if (processedCount % 100 === 0) {
              await new Promise(resolve => setTimeout(resolve, 0));
            }
          }
        })());

        await Promise.all(workers);

        const data = Array.from(senderMap, ([email, info]) => ({
          id: email,
          name: email,
          parent: '',
          size: info.count,
          domain: info.domain
        }));

        const total = data.reduce((sum, item) => sum + item.size, 0);
        setTotalUnread(total);
        setTreemapData(data);
        
        // Persist to localStorage
        saveToStorage(TREEMAP_DATA_KEY, JSON.stringify(data));
        saveToStorage(TOTAL_UNREAD_KEY, total.toString());
      } else {
        setTreemapData([]);
        setTotalUnread(0);
      }
    } catch (err) {
      console.error('fetchUnreadEmails error:', err);
      setError('Error fetching emails: ' + err.message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      setLoadingEmailCount(0);
      setTotalEmailCount(0);
    }
  }, []);

  const handleRefresh = useCallback(() => {
    if (isAuthenticated) {
      setIsRefreshing(true);
      fetchUnreadEmails();
    }
  }, [isAuthenticated, fetchUnreadEmails]);

  const handleClearData = useCallback(() => {
    setTreemapData(null);
    setTotalUnread(0);
    setSelectedTiles(new Set());
    localStorage.removeItem(TREEMAP_DATA_KEY);
    localStorage.removeItem(TOTAL_UNREAD_KEY);
  }, []);

  const handleTileSelect = useCallback((email) => {
    setSelectedTiles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(email)) {
        newSet.delete(email);
      } else {
        newSet.add(email);
      }
      return newSet;
    });
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedTiles(new Set());
  }, []);

  const handleCopyFilter = useCallback(async () => {
    if (selectedTiles.size === 0) return;
    
    const emails = Array.from(selectedTiles);
    const fromFilter = emails.length === 1 
      ? `from:${emails[0]}`
      : `from:(${emails.join(' OR ')})`;
    const filter = `${fromFilter} is:unread`;
    
    try {
      await navigator.clipboard.writeText(filter);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy filter:', err);
    }
  }, [selectedTiles]);

  const handleGroupThresholdChange = useCallback((value) => {
    const threshold = parseInt(value, 10) || 0;
    const maxThreshold = treemapData ? Math.max(...treemapData.map(d => d.size)) : 0;
    const clampedThreshold = Math.max(0, Math.min(threshold, maxThreshold));
    setGroupThreshold(clampedThreshold);
    localStorage.setItem(GROUP_THRESHOLD_KEY, clampedThreshold.toString());
  }, [treemapData]);

  const handleGroupModeChange = useCallback((mode) => {
    setGroupMode(mode);
    localStorage.setItem(GROUP_MODE_KEY, mode);
  }, []);

  const maxThreshold = treemapData && treemapData.length > 0 
    ? Math.max(...treemapData.map(d => d.size)) 
    : 0;

  if (isLoading && !tokenClient && !needsSetup) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Initializing...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated && !hasCachedData) {
    return (
      <div className="container mx-auto max-w-4xl p-6">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-primary mb-2">Email Treemap Visualizer</h1>
          <p className="text-muted-foreground">Visualize your unread emails by sender</p>
        </div>
        
        <div className="mb-6">
          <SetupGuide 
            onConfigSubmit={handleConfigSubmit} 
            error={error}
            isConfigured={!needsSetup}
          />
        </div>

        {!needsSetup && (
          <Card>
            <CardHeader>
              <CardTitle>Sign In</CardTitle>
              <CardDescription>Configuration complete. Sign in with Google to view your email treemap.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={handleLogin} className="w-full" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Connect your Gmail account
              </Button>
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Show cached data even when not authenticated
  if (!isAuthenticated && hasCachedData) {
    return (
      <div className="h-screen flex flex-col overflow-hidden">
        <header className="flex-shrink-0 flex justify-between items-center px-4 py-2 border-b">
          <h1 className="text-xl font-bold">Email Treemap Visualizer</h1>
          <div className="flex items-center gap-6">
          {treemapData && treemapData.length > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Senders with fewer than</span>
              <Input
                type="number"
                min={0}
                max={maxThreshold}
                value={groupThreshold}
                onChange={(e) => handleGroupThresholdChange(e.target.value)}
                className="w-14 h-7 text-sm"
              />
              <span className="text-muted-foreground">emails:</span>
              <select
                value={groupMode}
                onChange={(e) => handleGroupModeChange(e.target.value)}
                className="h-7 px-2 text-sm border rounded bg-background"
              >
                <option value="regroup">Group as "Other"</option>
                <option value="hide">Hide completely</option>
              </select>
            </div>
          )}
          <span className="text-primary font-semibold">{totalUnread} unread emails</span>
          <Button variant="outline" size="sm" onClick={handleClearData} className="text-destructive hover:bg-destructive hover:text-destructive-foreground" title="Remove cached email data">
            <Trash2 className="h-4 w-4 mr-2" />
            Clear Cache
          </Button>
          {selectedTiles.size > 0 && (
            <>
              <Button variant="default" size="sm" onClick={handleCopyFilter} className="bg-cyan-600 hover:bg-cyan-700" title="Copy Gmail search filter to clipboard">
                {copySuccess ? (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Filter ({selectedTiles.size})
                  </>
                )}
              </Button>
              <Button variant="ghost" size="sm" onClick={handleClearSelection} title="Clear selection">
                <X className="h-4 w-4" />
              </Button>
            </>
          )}
          <Button onClick={handleLogin} size="sm" disabled={isLoading} title="Sign in to fetch latest emails">
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Sign in to Refresh
          </Button>
          </div>
        </header>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="flex-1 relative overflow-hidden">
          <Suspense fallback={
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          }>
            <Treemap data={treemapData} groupThreshold={groupThreshold} groupMode={groupMode} selectedTiles={selectedTiles} onTileSelect={handleTileSelect} />
          </Suspense>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <header className="flex-shrink-0 flex justify-between items-center px-4 py-2 border-b">
        <h1 className="text-xl font-bold">Email Treemap Visualizer</h1>
        <div className="flex items-center gap-6">
          {treemapData && treemapData.length > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Senders with fewer than</span>
              <Input
                type="number"
                min={0}
                max={maxThreshold}
                value={groupThreshold}
                onChange={(e) => handleGroupThresholdChange(e.target.value)}
                className="w-14 h-7 text-sm"
              />
              <span className="text-muted-foreground">emails:</span>
              <select
                value={groupMode}
                onChange={(e) => handleGroupModeChange(e.target.value)}
                className="h-7 px-2 text-sm border rounded bg-background"
              >
                <option value="regroup">Group as "Other"</option>
                <option value="hide">Hide completely</option>
              </select>
            </div>
          )}
          <span className="text-primary font-semibold">{totalUnread} unread emails</span>
          {isAuthenticated && (
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing} title="Fetch latest unread emails">
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          )}
          {hasCachedData && (
            <Button variant="outline" size="sm" onClick={handleClearData} className="text-destructive hover:bg-destructive hover:text-destructive-foreground" title="Remove cached email data">
              <Trash2 className="h-4 w-4 mr-2" />
              Clear Cache
            </Button>
          )}
          {selectedTiles.size > 0 && (
            <>
              <Button variant="default" size="sm" onClick={handleCopyFilter} className="bg-cyan-600 hover:bg-cyan-700" title="Copy Gmail search filter to clipboard">
                {copySuccess ? (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Filter ({selectedTiles.size})
                  </>
                )}
              </Button>
              <Button variant="ghost" size="sm" onClick={handleClearSelection} title="Clear selection">
                <X className="h-4 w-4" />
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" onClick={handleLogout} title="Sign out of your Google account">
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {treemapData === null || isRefreshing ? (
        <div className="flex flex-1 flex-col items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">
            {totalEmailCount > 0 
              ? `Analyzing emails... (${loadingEmailCount}/${totalEmailCount})`
              : 'Analyzing emails...'}
          </p>
        </div>
      ) : treemapData.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center">
          <Mail className="h-16 w-16 text-green-500 mb-4" />
          <h2 className="text-2xl font-semibold text-green-600 mb-2">No unread emails!</h2>
          <p className="text-muted-foreground">Your inbox is up to date.</p>
        </div>
      ) : (
        <div className="flex-1 relative overflow-hidden">
          <Suspense fallback={
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          }>
            <Treemap data={treemapData} groupThreshold={groupThreshold} groupMode={groupMode} selectedTiles={selectedTiles} onTileSelect={handleTileSelect} />
          </Suspense>
        </div>
      )}
    </div>
  );
}

export default App;
