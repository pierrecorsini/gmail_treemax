import React, { useState, useEffect } from 'react';
import { Check, ChevronDown, ChevronRight, ExternalLink, RotateCcw, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

const SETUP_STEPS = [
  {
    id: 'console',
    title: 'Open Google Cloud Console',
    description: 'Click the link below to open Google Cloud Console. Sign in with your Google account if needed.',
    link: 'https://console.cloud.google.com/',
    linkText: 'Open Google Cloud Console'
  },
  {
    id: 'project',
    title: 'Create a new project',
    description: 'Click the project selector at the top (next to "Google Cloud"). Click "New Project", give it a name (e.g., "Email Treemap"), and click "Create". Then select your new project.'
  },
  {
    id: 'api',
    title: 'Enable Gmail API',
    description: 'In the search bar at the top, type "Gmail API" and click on it. Then click the "Enable" button. Alternatively: Go to "APIs & Services" > "Library", search for "Gmail API" and enable it.',
    link: 'https://console.cloud.google.com/apis/library/gmail.googleapis.com',
    linkText: 'Go to Gmail API'
  },
  {
    id: 'consent',
    title: 'Start OAuth consent screen setup',
    description: 'Click the link below to open the Branding page. Click "Get Started" or "Configure". Fill in: App name (e.g., "Email Treemap") and User support email (your email). Click "Next" or "Save and Continue".',
    link: 'https://console.cloud.google.com/auth/branding',
    linkText: 'Open OAuth Branding page'
  },
  {
    id: 'audience',
    title: 'Select User Type in Audience section',
    description: 'In the "Audience" step, select "External" as user type (required for personal Gmail accounts - Internal is only for Google Workspace organizations). Click "Next" or "Create".'
  },
  {
    id: 'testuser',
    title: 'Add yourself as a Test User',
    description: 'After creating the OAuth consent screen, go to "Audience" in the left menu. Scroll to "Test users" section, click "Add users", and add your Gmail address. This is REQUIRED for External apps in Testing status - you cannot use the app without being added as a test user.',
    link: 'https://console.cloud.google.com/auth/audience',
    linkText: 'Open Audience page'
  },
  {
    id: 'credentials',
    title: 'Create OAuth 2.0 Client ID',
    description: 'Click the link below to open the Clients page. Click "Create Client" at the top. Select "Web application" as Application type.',
    link: 'https://console.cloud.google.com/auth/clients',
    linkText: 'Open OAuth Clients page'
  },
  {
    id: 'origins',
    title: 'Add Authorized JavaScript origins',
    description: 'In the OAuth client form, find "Authorized JavaScript origins". Click "Add URI" and paste your app URL shown below. This tells Google to allow authentication requests from your app.'
  },
  {
    id: 'copy',
    title: 'Copy your Client ID',
    description: 'Click "Create" at the bottom. A popup will show your Client ID. Copy the Client ID value (it looks like: 123456789-abcdef.apps.googleusercontent.com). You will paste it in the next step.'
  }
];

function SetupGuide({ onConfigSubmit, error, isConfigured }) {
  const [checkedSteps, setCheckedSteps] = useState(() => {
    const saved = localStorage.getItem('setupCheckedSteps');
    return saved ? JSON.parse(saved) : [];
  });
  const [clientId, setClientId] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [expandedStep, setExpandedStep] = useState(() => {
    const saved = localStorage.getItem('setupCheckedSteps');
    const checked = saved ? JSON.parse(saved) : [];
    const firstUnchecked = SETUP_STEPS.findIndex(s => !checked.includes(s.id));
    return firstUnchecked >= 0 ? firstUnchecked : 0;
  });

  useEffect(() => {
    const firstUnchecked = SETUP_STEPS.findIndex(s => !checkedSteps.includes(s.id));
    if (firstUnchecked >= 0 && firstUnchecked !== expandedStep) {
      setExpandedStep(firstUnchecked);
    }
  }, [checkedSteps]);

  const toggleStep = (stepId, index) => {
    const newChecked = checkedSteps.includes(stepId)
      ? checkedSteps.filter(id => id !== stepId)
      : [...checkedSteps, stepId];
    setCheckedSteps(newChecked);
    localStorage.setItem('setupCheckedSteps', JSON.stringify(newChecked));
  };

  const markComplete = (stepId) => {
    if (!checkedSteps.includes(stepId)) {
      const newChecked = [...checkedSteps, stepId];
      setCheckedSteps(newChecked);
      localStorage.setItem('setupCheckedSteps', JSON.stringify(newChecked));
    }
  };

  const currentOrigin = window.location.origin;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!clientId.trim()) return;
    
    setIsValidating(true);
    try {
      await onConfigSubmit(clientId);
    } finally {
      setIsValidating(false);
    }
  };

  const resetChecklist = () => {
    setCheckedSteps([]);
    localStorage.removeItem('setupCheckedSteps');
    setExpandedStep(0);
  };

  return (
    <Card className={isConfigured ? 'border-green-500' : ''}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          {isConfigured && <Check className="h-5 w-5 text-green-600" />}
          {isConfigured ? 'Configuration Complete' : 'API Configuration'}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Always visible API input */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="clientId">Google OAuth 2.0 Client ID</Label>
            <Input
              type="text"
              id="clientId"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="123456789-abcdef.apps.googleusercontent.com"
              disabled={isValidating}
            />
          </div>
          <Button type="submit" className="w-full" disabled={isValidating || !clientId.trim()}>
            {isValidating ? 'Verifying...' : isConfigured ? 'Update Configuration' : 'Verify and Save'}
          </Button>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </form>

        {/* Compact collapsible setup guide */}
        <div className="border rounded-lg">
          <button
            type="button"
            onClick={() => setShowGuide(!showGuide)}
            className="w-full flex items-center gap-2 p-3 text-left text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
          >
            <HelpCircle className="h-4 w-4" />
            <span>Need help? {showGuide ? 'Hide' : 'Show'} setup guide</span>
            {checkedSteps.length > 0 && !showGuide && (
              <span className="ml-auto text-xs">
                ({checkedSteps.length}/{SETUP_STEPS.length} steps)
              </span>
            )}
            {showGuide ? <ChevronDown className="h-4 w-4 ml-auto" /> : <ChevronRight className="h-4 w-4 ml-auto" />}
          </button>
          
          {showGuide && (
            <div className="border-t px-4 py-4 space-y-4">
              <div className="space-y-2">
                <Progress value={(checkedSteps.length / SETUP_STEPS.length) * 100} className="h-1.5" />
                <p className="text-xs text-muted-foreground text-center">
                  {checkedSteps.length} / {SETUP_STEPS.length} steps completed
                </p>
              </div>

              <div className="bg-muted p-3 rounded-md">
                <p className="text-xs mb-1">
                  <strong>Your app URL:</strong>
                </p>
                <code className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs">{currentOrigin}</code>
              </div>
              
              <div className="space-y-1.5">
                {SETUP_STEPS.map((step, index) => {
                  const isChecked = checkedSteps.includes(step.id);
                  const isExpanded = expandedStep === index;
                  
                  return (
                    <div 
                      key={step.id} 
                      className={`border rounded-md transition-all ${isChecked ? 'border-green-500 bg-green-50' : ''} ${isExpanded ? 'ring-1 ring-primary' : ''}`}
                    >
                      <div 
                        className="flex items-center gap-2 p-2 cursor-pointer hover:bg-muted/50"
                        onClick={() => setExpandedStep(index)}
                      >
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); toggleStep(step.id, index); }}
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-colors shrink-0 ${isChecked ? 'bg-green-500 text-white' : isExpanded ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}
                        >
                          {isChecked ? <Check className="h-3 w-3" /> : index + 1}
                        </button>
                        <h4 className="flex-1 text-sm font-medium">{step.title}</h4>
                        {isExpanded ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                      </div>
                      
                      {isExpanded && (
                        <div className="px-2 pb-2 ml-8">
                          <p className="text-xs text-muted-foreground mb-2">{step.description}</p>
                          {step.id === 'origins' && (
                            <div className="bg-primary/10 border-l-2 border-primary p-2 rounded-r-md mb-2">
                              <strong className="text-xs">Add this URL:</strong>{' '}
                              <code className="bg-white px-1.5 py-0.5 rounded text-primary text-xs">{currentOrigin}</code>
                            </div>
                          )}
                          {step.link && (
                            <a 
                              href={step.link} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="inline-flex items-center text-xs text-primary hover:underline mb-2"
                            >
                              {step.linkText} <ExternalLink className="ml-1 h-2.5 w-2.5" />
                            </a>
                          )}
                          {!isChecked && (
                            <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={() => markComplete(step.id)}>
                              Mark Complete
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <Button variant="ghost" size="sm" className="w-full text-xs" onClick={resetChecklist}>
                <RotateCcw className="mr-1.5 h-3 w-3" />
                Reset Checklist
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default SetupGuide;
