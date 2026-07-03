(() => {
  const bar = document.getElementById('bookmarks-bar');
  if (!bar || typeof chrome === 'undefined' || !chrome.bookmarks) return;

  function favicon(url) {
    try {
      var u = new URL(url);
      return 'https://www.google.com/s2/favicons?domain=' + u.hostname + '&sz=32';
    } catch (e) { return null; }
  }

  function checkOverflow(el) {
    requestAnimationFrame(function() {
      el.classList.toggle('has-overflow', el.scrollHeight > el.clientHeight + 4);
    });
  }

  function createBookmark(node) {
    var a = document.createElement('a');
    a.className = 'bm-item';
    a.href = node.url;
    a.title = node.title || node.url;

    if (node.url) {
      var favUrl = favicon(node.url);
      if (favUrl) {
        var img = document.createElement('img');
        img.className = 'bm-favicon';
        img.src = favUrl;
        img.alt = '';
        img.onerror = function() {
          var span = document.createElement('span');
          span.className = 'bm-favicon';
          span.textContent = (node.title || node.url || '?')[0];
          a.replaceChild(span, img);
        };
        a.appendChild(img);
      }
    }

    a.appendChild(document.createTextNode(node.title || node.url || ''));
    return a;
  }

  function createFolder(node, depth) {
    depth = depth || 0;
    var folder = document.createElement('div');
    folder.className = 'bm-folder';

    var title = document.createElement('div');
    title.className = 'bm-folder-title';
    title.textContent = node.title || 'Папка';
    folder.appendChild(title);

    if (node.children && node.children.length) {
      var dropdown = document.createElement('div');
      dropdown.className = 'bm-dropdown';
      renderLevel(node.children, dropdown, depth + 1);

      if (dropdown.children.length) {
        var hideTimer = null;

        function showDropdown() {
          clearTimeout(hideTimer);
          var rect = title.getBoundingClientRect();
          dropdown.style.position = 'fixed';
          dropdown.style.left = rect.left + 'px';
          dropdown.style.top = rect.bottom + 'px';
          dropdown.style.display = 'block';
          checkOverflow(dropdown);
          dropdown.onscroll = function() { checkOverflow(dropdown); };
        }

        function scheduleHide() {
          clearTimeout(hideTimer);
          hideTimer = setTimeout(function() {
            if (!folder.matches(':hover')) {
              dropdown.style.display = 'none';
            }
          }, 80);
        }

        title.addEventListener('mouseenter', showDropdown);
        title.addEventListener('mouseleave', scheduleHide);
        dropdown.addEventListener('mouseenter', function() { clearTimeout(hideTimer); });
        dropdown.addEventListener('mouseleave', scheduleHide);

        folder.appendChild(dropdown);
      }
    }

    return folder;
  }

  function renderLevel(children, container, depth) {
    depth = depth || 0;
    var treeWrap = null;

    if (depth > 0 && children.length) {
      treeWrap = document.createElement('div');
      treeWrap.className = 'bm-tree';
    }

    for (var i = 0; i < children.length; i++) {
      var child = children[i];
      var target = treeWrap || container;
      if (child.url) {
        target.appendChild(createBookmark(child));
      } else if (child.children) {
        target.appendChild(createFolder(child, depth));
      }
    }

    if (treeWrap && treeWrap.children.length) {
      container.appendChild(treeWrap);
    }
  }

  function load() {
    chrome.bookmarks.getTree(function(tree) {
      if (chrome.runtime.lastError || !tree || !tree[0]) return;
      var roots = tree[0].children;
      for (var i = 0; i < roots.length; i++) {
        if (roots[i].id === '1') {
          var frag = document.createDocumentFragment();
          renderLevel(roots[i].children, frag);
          bar.replaceChildren(frag);
          return;
        }
      }
    });
  }

  load();

  var timer;
  function reload() {
    clearTimeout(timer);
    timer = setTimeout(load, 300);
  }

  chrome.bookmarks.onChanged.addListener(reload);
  chrome.bookmarks.onCreated.addListener(reload);
  chrome.bookmarks.onRemoved.addListener(reload);
  chrome.bookmarks.onMoved.addListener(reload);
})();
