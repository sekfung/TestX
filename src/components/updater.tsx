import { useState, useEffect } from 'react';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Download, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';

interface UpdateInfo {
  version: string;
  date: string;
  body: string;
}

export function Updater() {
  const [isChecking, setIsChecking] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showDialog, setShowDialog] = useState(false);

  const checkForUpdates = async () => {
    setIsChecking(true);
    setError(null);
    
    try {
      const update = await check();
      
      if (update?.available) {
        setUpdateAvailable(true);
        setUpdateInfo({
          version: update.version,
          date: update.date || '',
          body: update.body || ''
        });
        setShowDialog(true);
      } else {
        setError('当前已是最新版本');
      }
    } catch (err) {
      console.error('检查更新失败:', err);
      setError('检查更新失败，请稍后重试');
    } finally {
      setIsChecking(false);
    }
  };

  const downloadAndInstall = async () => {
    if (!updateAvailable) return;
    
    setIsDownloading(true);
    setDownloadProgress(0);
    
    try {
      const update = await check();
      
      if (update?.available) {
        await update.downloadAndInstall((event) => {
          switch (event.event) {
            case 'Started':
              setDownloadProgress(0);
              break;
            case 'Progress':
              if (event.data && typeof event.data === 'object' && 'chunkLength' in event.data && 'contentLength' in event.data) {
                const chunkLength = event.data.chunkLength as number;
                const contentLength = event.data.contentLength as number;
                if (typeof chunkLength === 'number' && typeof contentLength === 'number' && contentLength > 0) {
                  const progress = Math.round((chunkLength / contentLength) * 100);
                  setDownloadProgress(progress);
                }
              }
              break;
            case 'Finished':
              setDownloadProgress(100);
              break;
          }
        });
        
        // 安装完成后重启应用
        await relaunch();
      }
    } catch (err) {
      console.error('下载更新失败:', err);
      setError('下载更新失败，请稍后重试');
      setIsDownloading(false);
    }
  };

  // 自动检查更新（应用启动时）
  useEffect(() => {
    const autoCheck = async () => {
      try {
        const update = await check();
        if (update?.available) {
          setUpdateAvailable(true);
          setUpdateInfo({
            version: update.version,
            date: update.date || '',
            body: update.body || ''
          });
          setShowDialog(true);
        }
      } catch (err) {
        console.error('自动检查更新失败:', err);
      }
    };

    // 延迟3秒后自动检查更新
    const timer = setTimeout(autoCheck, 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={checkForUpdates}
        disabled={isChecking || isDownloading}
        className="flex items-center gap-2"
      >
        {isChecking ? (
          <RefreshCw className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        {isChecking ? '检查中...' : '检查更新'}
      </Button>

      {error && (
        <Alert className="mt-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              发现新版本
            </DialogTitle>
            <DialogDescription>
              {updateInfo && (
                <div className="space-y-2">
                  <p>版本: {updateInfo.version}</p>
                  {updateInfo.date && <p>发布日期: {updateInfo.date}</p>}
                  {updateInfo.body && (
                    <div>
                      <p className="font-medium">更新内容:</p>
                      <div className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">
                        {updateInfo.body}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          
          {isDownloading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>下载进度</span>
                <span>{downloadProgress}%</span>
              </div>
              <Progress value={downloadProgress} className="w-full" />
            </div>
          )}
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDialog(false)}
              disabled={isDownloading}
            >
              稍后更新
            </Button>
            <Button
              onClick={downloadAndInstall}
              disabled={isDownloading}
              className="flex items-center gap-2"
            >
              {isDownloading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {isDownloading ? '下载中...' : '立即更新'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}