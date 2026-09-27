const page=document.body.dataset.page??'home';
if(page==='playground')void import('./site.js');
else void import('./pages.js').then(({renderPage})=>renderPage(page));
