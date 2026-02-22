import { useState, useCallback, lazy, Suspense, useEffect } from 'react';
import { gapi } from 'gapi-script';
import { Loader2, Mail, LogOut, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
const Treemap = lazy(() => import('./Treemap.jsx'));
import SetupGuide from './SetupGuide.jsx';

console.log('[App.jsx] All imports loaded');

const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest';
const SCOPES = 'https://www.googleapis.com/auth/gmail.readonly';
const EMAIL_REGEX = /<([^>]+)>/;
const STORAGE_KEY = 'googleClientId';
const GROUP_THRESHOLD_KEY = 'treemapGroupThreshold';
const GROUP_MODE_KEY = 'treemapGroupMode';
const TREEMAP_DATA_KEY = 'treemapData';
const TOTAL_UNREAD_KEY = 'treemapTotalUnread';

// Helper to safely parse JSON from localStorage
const loadFromStorage = (key, defaultValue) => {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : defaultValue;
  } catch {
    return defaultValue;
  }
};

function App() {
  console.log('[App] function App() called');
  const [clientId, setClientId] = useState(() => localStorage.getItem(STORAGE_KEY) || '');
  const [needsSetup, setNeedsSetup] = useState(() => !localStorage.getItem(STORAGE_KEY));
  const [tokenClient, setTokenClient] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [treemapData, setTreemapData] = useState(() => {
    const saved = loadFromStorage(TREEMAP_DATA_KEY, null);
    console.log('[App] Loading cached data:', { saved: saved?.length, firstItem: saved?.[0] });
    // Validate cached data structure
    if (saved && Array.isArray(saved)) {
      const valid = saved.filter(item => 
        item && 
        typeof item.size === 'number' && 
        Number.isFinite(item.size) && 
        item.size > 0
      );
      console.log('[App] Valid cached items:', valid.length);
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
  const hasCachedData = treemapData !== null && treemapData.length > 0;
  
  console.log('[App] Render state:', { 
    isAuthenticated, 
    hasCachedData, 
    treemapDataLength: treemapData?.length,
    isLoading,
    needsSetup,
    tokenClient: !!tokenClient
  });

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
      
      const response = await gapi.client.gmail.users.messages.list({
        'userId': 'me',
        'q': 'is:unread',
        'maxResults': 500
      });

      if (response.result.messages) {
        const messages = response.result.messages;
        setTotalEmailCount(messages.length);
        const senderMap = new Map();
        const batchSize = 50;
        let baseDelay = 500;
        let consecutiveRateLimits = 0;
        let processedCount = 0;

        // Helper to fetch with rate limit detection and retry
        const fetchWithRetry = async (messageId, retries = 3) => {
          for (let attempt = 0; attempt < retries; attempt++) {
            try {
              const result = await gapi.client.gmail.users.messages.get({
                'userId': 'me',
                'id': messageId,
                'format': 'metadata',
                'metadataHeaders': ['From']
              });
              return { success: true, data: result };
            } catch (err) {
              if (err.status === 429) {
                // Rate limited - exponential backoff
                const backoffDelay = Math.min(5000 * Math.pow(2, attempt), 30000);
                console.warn(`Rate limited, waiting ${backoffDelay}ms before retry...`);
                await new Promise(resolve => setTimeout(resolve, backoffDelay));
              } else {
                return { success: false, data: null };
              }
            }
          }
          return { success: false, data: null };
        };

        for (let i = 0; i < messages.length; i += batchSize) {
          const batch = messages.slice(i, Math.min(i + batchSize, messages.length));
          
          // Fetch messages with retry logic
          const results = await Promise.all(
            batch.map(message => fetchWithRetry(message.id))
          );

          let rateLimitHit = false;
          
          for (const { success, data: msgDetail } of results) {
            processedCount++;
            if (!success) {
              rateLimitHit = true;
              continue;
            }
            if (!msgDetail?.result?.payload?.headers) continue;
            const fromHeader = msgDetail.result.payload.headers.find(h => h.name === 'From');
            if (fromHeader) {
              const emailMatch = fromHeader.value.match(EMAIL_REGEX);
              const email = emailMatch ? emailMatch[1] : fromHeader.value;
              const atIndex = email.lastIndexOf('@');
              const domain = atIndex > -1 ? email.substring(atIndex + 1) : 'unknown';
              senderMap.set(email, { count: (senderMap.get(email)?.count || 0) + 1, domain });
            }
          }

          setLoadingEmailCount(processedCount);

          // Adapt delay based on rate limiting
          if (rateLimitHit) {
            consecutiveRateLimits++;
            baseDelay = Math.min(baseDelay * 1.5, 5000);
          } else {
            consecutiveRateLimits = Math.max(0, consecutiveRateLimits - 1);
            // Gradually reduce delay if no rate limits
            if (consecutiveRateLimits === 0) {
              baseDelay = Math.max(300, baseDelay * 0.9);
            }
          }

          if (i + batchSize < messages.length) {
            await new Promise(resolve => setTimeout(resolve, baseDelay));
          }
        }

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
        localStorage.setItem(TREEMAP_DATA_KEY, JSON.stringify(data));
        localStorage.setItem(TOTAL_UNREAD_KEY, total.toString());
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
    console.log('[App] RENDERING: Loading screen');
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
    console.log('[App] RENDERING: Login/setup screen');
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
    console.log('[App] RENDERING: Cached data screen (not authenticated)');
    return (
      <div className="h-screen flex flex-col overflow-hidden">
        <header className="flex-shrink-0 flex justify-between items-center px-4 py-2 border-b">
          <h1 className="text-xl font-bold">Email Treemap Visualizer</h1>
          <div className="flex items-center gap-6">
            {treemapData && treemapData.length > 0 && (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Label className="text-sm whitespace-nowrap">Min emails to show:</Label>
                  <Input
                    type="number"
                    min={0}
                    max={maxThreshold}
                    value={groupThreshold}
                    onChange={(e) => handleGroupThresholdChange(e.target.value)}
                    className="w-16 h-8"
                  />
                </div>
                <div className="flex items-center gap-2 border-l pl-4">
                  <Label className="text-sm">Senders below:</Label>
                  <select
                    value={groupMode}
                    onChange={(e) => handleGroupModeChange(e.target.value)}
                    className="h-8 px-2 text-sm border rounded bg-background"
                  >
                    <option value="regroup">Regroup</option>
                    <option value="hide">Hide</option>
                  </select>
                </div>
              </div>
            )}
            <span className="text-primary font-semibold">{totalUnread} unread emails</span>
            <Button onClick={handleLogin} size="sm" disabled={isLoading}>
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
            <Treemap data={treemapData} groupThreshold={groupThreshold} groupMode={groupMode} />
          </Suspense>
        </div>
      </div>
    );
  }

  console.log('[App] RENDERING: Authenticated main screen');
  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <header className="flex-shrink-0 flex justify-between items-center px-4 py-2 border-b">
        <h1 className="text-xl font-bold">Email Treemap Visualizer</h1>
        <div className="flex items-center gap-6">
          {treemapData && treemapData.length > 0 && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Label className="text-sm whitespace-nowrap">Min emails to show:</Label>
                <Input
                  type="number"
                  min={0}
                  max={maxThreshold}
                  value={groupThreshold}
                  onChange={(e) => handleGroupThresholdChange(e.target.value)}
                  className="w-16 h-8"
                />
              </div>
              <div className="flex items-center gap-2 border-l pl-4">
                <Label className="text-sm">Senders below:</Label>
                <select
                  value={groupMode}
                  onChange={(e) => handleGroupModeChange(e.target.value)}
                  className="h-8 px-2 text-sm border rounded bg-background"
                >
                  <option value="regroup">Regroup</option>
                  <option value="hide">Hide</option>
                </select>
              </div>
            </div>
          )}
          <span className="text-primary font-semibold">{totalUnread} unread emails</span>
          {isAuthenticated && (
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleLogout}>
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
            <Treemap data={treemapData} groupThreshold={groupThreshold} groupMode={groupMode} />
          </Suspense>
        </div>
      )}
    </div>
  );
}

export default App;
