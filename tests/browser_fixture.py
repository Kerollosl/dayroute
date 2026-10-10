"""Browser backup/import integration with routing/geocoding offline.
Requires Playwright Chromium. Vendor libraries are served from a local test cache.
"""
import functools,http.server,threading,unittest,re,tempfile
from pathlib import Path
from urllib.request import urlopen
from playwright.sync_api import sync_playwright

class BrowserFixture(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.root=Path(__file__).resolve().parents[1]
  cls.assets={}
  urls=re.findall(r'(?:src|href)="(https://cdn.jsdelivr.net/[^\"]+)"',(cls.root/'index.html').read_text())
  for url in urls:
   with urlopen(url,timeout=60) as r:cls.assets[url]=r.read()
  handler=functools.partial(http.server.SimpleHTTPRequestHandler,directory=str(cls.root))
  cls.server=http.server.ThreadingHTTPServer(('127.0.0.1',0),handler)
  threading.Thread(target=cls.server.serve_forever,daemon=True).start()
  cls.pw=sync_playwright().start();cls.browser=cls.pw.chromium.launch(args=['--enable-webgl','--use-gl=angle','--use-angle=swiftshader'])
 @classmethod
 def tearDownClass(cls):
  cls.browser.close();cls.pw.stop();cls.server.shutdown();cls.server.server_close()
 def test_import_export_desktop_and_phone(self):
  for width in (1280,390):
   with self.subTest(width=width):
    page=self.browser.new_page(viewport={'width':width,'height':900})
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    def route(req):
     if req.request.url in self.assets:req.fulfill(body=self.assets[req.request.url],content_type='text/css' if req.request.url.endswith('.css') else 'application/javascript')
     elif req.request.url.startswith('http://127.0.0.1:'):req.continue_()
     else:req.abort()
    page.route('**/*',route)
    page.goto(f'http://127.0.0.1:{self.server.server_port}/')
    page.locator('#btnExportDay').wait_for()
    backup=b'{"version":1,"day":"2026-10-10","stops":[{"id":"fixture","name":"Fixture appointment","address":"Example","lat":38.9,"lng":-77.1,"day":null,"dwell":30}],"origin":null}'
    page.locator('input[type=file]').set_input_files({'name':'day.json','mimeType':'application/json','buffer':backup})
    if width < 600:page.locator('[data-view=places]').click()
    page.get_by_text('Fixture appointment',exact=True).first.wait_for()
    with page.expect_download() as download:page.locator('#btnExportDay').click()
    text=Path(download.value.path()).read_text()
    self.assertIn('Fixture appointment',text)
    self.assertFalse(errors,errors)
    page.close()
if __name__=='__main__':unittest.main()
