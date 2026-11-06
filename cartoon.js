const cartoonSkins=[
 {id:'mint',name:'薄荷小诊所',icon:'🌿',description:'清新薄荷 · 奶油绿',wash:'#e6f5e9',edge:'#86b6a1',candy:'#a5ddbd'},
 {id:'peach',name:'桃桃布丁屋',icon:'🍑',description:'蜜桃奶油 · 暖杏色',wash:'#fff0e4',edge:'#d5a48d',candy:'#ffc5a8'},
 {id:'sunshine',name:'向日葵课堂',icon:'🌻',description:'阳光鹅黄 · 小花园',wash:'#fff6d6',edge:'#d5bd70',candy:'#f5d880'},
 {id:'lavender',name:'芋泥云朵岛',icon:'☁️',description:'柔软香芋 · 云朵紫',wash:'#f0eafa',edge:'#b3a0cc',candy:'#d4c2ef'},
 {id:'ocean',name:'海盐泡泡湾',icon:'🐳',description:'清透天蓝 · 小鲸鱼',wash:'#e4f3fc',edge:'#90b8cf',candy:'#b5dcf0'},
 {id:'forest',name:'森林蘑菇屋',icon:'🍄',description:'抹茶草绿 · 森林系',wash:'#eff4db',edge:'#a6bb7e',candy:'#cee2a7'},
 {id:'sakura',name:'樱花棉花糖',icon:'🌸',description:'柔粉樱花 · 棉花糖',wash:'#fce9ef',edge:'#d6a5b8',candy:'#f3bfd3'},
 {id:'night',name:'晚安星星站',icon:'🌙',description:'深蓝星空 · 夜间款',wash:'#22233f',edge:'#8b8db7',candy:'#737ab0'}
];
const skinOptions=cartoonSkins.map(s=>`<option value="${s.id}">${s.icon} ${s.name}</option>`).join('');
for(const id of ['skinPicker','launchSkin']){document.getElementById(id).innerHTML=skinOptions;document.getElementById(id).value=document.body.dataset.skin}
const cloud=`<svg class="cartoon-cloud" viewBox="0 0 180 100" aria-hidden="true"><path d="M35 82C4 82 4 43 34 40C35 13 71 5 85 30C107 1 143 19 142 44C177 40 186 82 152 84Z"/><g class="cloud-face"><path d="M72 57v4M106 57v4M83 66q6 7 12 0"/></g></svg>`;
document.querySelector('#launch').insertAdjacentHTML('afterbegin',`<div class="cartoon-clouds" aria-hidden="true">${cloud.repeat(3)}<span class="cartoon-spark one">✦</span><span class="cartoon-spark two">✿</span></div>`);
document.body.insertAdjacentHTML('beforeend',`<dialog id="skinGallery" class="skin-gallery"><button class="skin-gallery-close" id="closeSkinGallery" aria-label="关闭换装小屋">✕</button><h2>🎨 小肺的换装小屋</h2><p>选一张喜欢的配色卡，给整个探索站换个新心情。影像显示和测量不随皮肤改变。</p><div class="skin-gallery-grid">${cartoonSkins.map(s=>`<button class="skin-card" data-skin-choice="${s.id}" aria-pressed="false" style="--preview-wash:${s.wash};--preview-edge:${s.edge};--preview-candy:${s.candy}"><span class="skin-preview">${s.icon}</span><strong>${s.name}</strong><small>${s.description}</small></button>`).join('')}</div></dialog>`);
const originalSetSkin=setSkin;
setSkin=function(value){originalSetSkin(value);document.querySelectorAll('[data-skin-choice]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.skinChoice===document.body.dataset.skin)))};
document.querySelectorAll('[data-skin-choice]').forEach(button=>button.onclick=()=>{setSkin(button.dataset.skinChoice);chime()});
document.querySelector('#closeSkinGallery').onclick=()=>document.querySelector('#skinGallery').close();
for(const selector of ['header','.launch-nav']){const button=document.createElement('button');button.className='skin-house';button.textContent='🎨 换装小屋';button.onclick=()=>document.querySelector('#skinGallery').showModal();document.querySelector(selector).append(button)}
setSkin(document.body.dataset.skin);
