# kodeksdetstva

## Домен и доступность из РФ (28.09.2026) — ЧИТАТЬ ПЕРЕД изменением DNS/хостинга

**kodeksdetstva.ru**: `@` A 9.247.5.206 (AAAA удалены), `www` CNAME kodeksdetstva.ru, серое облако. Посетитель → nginx на NL-сервере → GitHub Pages (`balibudda/kodeksdetstva-ru`, по http на 185.199.108.153, Host = домен). Через сервер только потому, что GitHub больше часа не выпускал сертификат; когда выпустит (`gh api repos/balibudda/kodeksdetstva-ru/pages` → `https_certificate.state`), можно вернуть напрямую как kodeksdeneg (A 185.199.108-111.153 + AAAA 2606:50c0:800x::153). Сертификат сейчас — Let's Encrypt на NL-сервере.

Полная схема всех доменов Ника, почему так и как проверять: `~/WebstormProjects/vpn-nikolablajen/DOMAINS.md`.
