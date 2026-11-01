# Ativar a BRASA — passos por ordem

O código já está pronto, na pasta da BRASA. Falta só ligar as contas da BRASA.
Nada disto usa a conta de outro site. Tudo é só da BRASA.

## 1. Criar o projeto no Supabase
- Abrir supabase.com e criar um projeto novo com o nome BRASA.
- Guardar o endereço do projeto (Project URL) e a chave pública (a chave que pode ser partilhada, nunca a chave secreta).

## 2. Correr as 7 migrações, por esta ordem
Na pasta supabase/migrations, na ordem:
1. 20261101000001_brasa_core.sql
2. 20261101000002_brasa_rls.sql
3. 20261101000003_brasa_seed.sql
4. 20261101000004_brasa_storage.sql
5. 20261101000005_brasa_delivery.sql
6. 20261101000006_brasa_chat_stock_whatsapp.sql
7. 20261101000007_brasa_fees.sql (taxa de entrega — ver abaixo)

## 3. Conta e admin
- Desligar "Confirm email" no Supabase (senão a conta não entra).
- Criar a conta do admin no próprio site, em Conta, com email e palavra-passe.
- Pôr is_admin = true nessa conta, no editor SQL do Supabase.
- Dizer à Muse: o Project URL, a chave pública e o email do admin.
  A Muse põe esses 3 valores em js/config.js. A chave pública pode ser partilhada; a palavra-passe nunca.

## 4. Pagamento M-Pesa (conta só da BRASA)
- Criar uma conta de pagamento só para a BRASA, com o número M-Pesa da BRASA.
- Nos segredos das Edge Functions, pôr só estas 3 chaves, tu mesma:
  ZUMBO_API_KEY, ZUMBO_MERCHANT_ID, ZUMBO_WEBHOOK_SECRET
- Nunca pôr estas chaves no código, no GitHub nem no chat.
  Ninguém precisa que as envies: és tu que as escreves no Supabase.

## 5. Ligar as funções
- Publicar as 2 funções: create-payment e zumbopay-webhook.
- Apontar o aviso de pagamento (webhook) do painel de pagamento para:
  <Project URL>/functions/v1/zumbopay-webhook
- Depois disto, a Muse liga o site ao projeto e testa.

## Taxa de entrega — como funciona
- O cliente paga a encomenda e a taxa de entrega juntas, num só pagamento M-Pesa, com a conta clara no carrinho: Subtotal + Taxa de entrega = Total a pagar.
- No carrinho há 2 escolhas: "Entrega ao domicílio" (soma a taxa e pede a morada, que é obrigatória) ou "Levantar no local" (sem taxa, sem morada).
- A taxa começa em 150 MT (migração 0007). O admin muda-a em Admin > Definições da loja > Taxa de entrega, e o site passa logo a usar o novo valor — não é preciso publicar o site de novo.
- O servidor recalcula sempre tudo: soma os preços de confiança, lê a taxa nas definições e só depois pede o pagamento. Se a taxa não estiver configurada, o pagamento não é criado e a encomenda fica pendente, sem cobrança. O cliente nunca pode mudar a taxa a partir do telefone.

## 6. Teste final
- Teste pequeno com M-Pesa: comprar 1 produto barato, confirmar
  que a encomenda fica paga, o recibo aparece no chat e o stock baixa.
- No admin, confirmar que a encomenda, o cliente e a conversa aparecem.

## Ainda falta decidir / mandar
- Domínio da BRASA (ainda não escolhido).
- Grupo e WhatsApp da loja (põe no admin, em Definições da loja, quando tiveres os links reais).

## Instalar no telefone (aplicativo)

A BRASA já é instalável: no telefone, abre o site no navegador e toca em "Adicionar à tela inicial" (ou "Instalar aplicativo"). O ícone é o hambúrguer branco sobre fundo preto, e o aplicativo abre em ecrã cheio, sem a barra do navegador. As páginas tentam sempre a rede primeiro, por isso uma versão nova nunca fica presa na versão velha.

## Atualização 2026-11-01 — zonas, rastreio, chat
- Correr a migração `supabase/migrations/20261101000008_brasa_zones_tracking_avatars.sql`
  no editor SQL (depois da 0007). Ela cria: tabela `delivery_zones` com 8 zonas
  iniciais (Maputo + Matola, taxas editáveis), estado `on_the_way` (A caminho),
  `profiles.avatar_url`, tempos de preparo/entrega em `site_settings` e
  realtime para as mensagens do chat.
- Voltar a publicar a Edge Function `create-payment` (o código novo lê a taxa
  da zona escolhida; sem zona, usa a taxa única antiga). O ficheiro pronto
  para colar no editor do painel é `supabase/functions-deploy/create-payment.ts`.
- Depois disto: zonas e tempos editam-se em Admin > Definições; a foto do
  cliente carrega-se em Conta; o rastreio aparece em Conta > Histórico.
