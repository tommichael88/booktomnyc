"""
_page.py -- Python's door to the page as a browser runs it. The URL-to-file rule is stated ONCE, in _page.js; this asks it (a subprocess), so there is no second
definition to drift (R-INVARIANT-SINGLEDEF). See _page.js for why the page's external <script src> files must be in place before anything reads "qr.html".

    from _page import read_page
    html = read_page(path_to_qr_html)      # raises if the page names a module file the repo does not have
"""
import os
import subprocess

_HERE = os.path.dirname(os.path.abspath(__file__))


def read_page(qr_path):
    r = subprocess.run(["node", os.path.join(_HERE, "_page.js"), os.path.abspath(qr_path)],
                       capture_output=True, text=True, encoding="utf-8")
    if r.returncode != 0:
        raise RuntimeError("_page.js could not assemble %s: %s" % (qr_path, r.stderr.strip()))
    return r.stdout
