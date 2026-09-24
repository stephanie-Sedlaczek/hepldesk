# Guia rapido do Firebase

Este projeto ja esta preparado para uso interno da empresa com Firebase Hosting, Authentication e regras do Cloud Firestore.

O link do site pode existir na internet, mas as telas internas e o banco ficam protegidos por login. Para usar o sistema, a pessoa precisa existir no Firebase Authentication e tambem na colecao `usuarios` com `ativo: true`.

## Arquivos criados

- `index.html`: abre a tela de login quando o endereco raiz do site e acessado.
- `.firebaserc`: aponta o projeto local para `helpdesk-raageplan`.
- `firebase.json`: configura o Firebase Hosting e o Firestore.
- `firestore.rules`: define as permissoes de administrador e usuario comum.
- `firestore.indexes.json`: arquivo de indices do Firestore.

## Como devem ficar as permissoes

Na colecao `usuarios`, cada documento deve usar o UID do usuario do Firebase Authentication como ID.

Atencao: a colecao precisa se chamar exatamente `usuarios`, em minusculo. Se criar `Usuarios`, `usuario Adm` ou outro nome, o site nao encontra o cadastro.

Se a pessoa existir somente no Authentication, mas nao existir em `usuarios/{UID}`, ela nao entra no sistema.

O campo `ativo` precisa ser booleano, ou seja, valor `true` de verdade, nao texto `"true"`.

Exemplo de usuario comum:

```txt
usuarios/{UID_DO_USUARIO}
nome: "Nome do usuario"
email: "usuario@empresa.com"
perfil: "usuario"
ativo: true
```

Exemplo de administrador:

```txt
usuarios/{UID_DO_ADMIN}
nome: "Nome do administrador"
email: "admin@empresa.com"
perfil: "admin"
ativo: true
```

## Comandos para publicar

No terminal do VS Code:

```bash
firebase login
firebase deploy
```

Para publicar somente as regras do Firestore:

```bash
firebase deploy --only firestore:rules
```

Para publicar somente o site:

```bash
firebase deploy --only hosting
```

## Quando aparecer "usuario nao cadastrado ou inativo"

Confira estes pontos:

1. O e-mail existe em Authentication.
2. O documento existe em `usuarios/{UID_REAL}`.
3. O UID do documento e igual ao UID do Authentication, nao pode ser apelido.
4. O campo `ativo` esta como `true`.
5. O campo `perfil` esta como `admin` ou `usuario`.
6. A colecao esta em minusculo: `usuarios`.

## Checklist para liberar novos usuarios

Antes de passar o link para uma pessoa da empresa:

1. Criar o login dela em Authentication com e-mail e senha.
2. Copiar o UID gerado pelo Authentication.
3. Criar o documento `usuarios/{UID_COPIADO}` no Firestore.
4. Preencher `nome`, `email`, `perfil` e `ativo`.
5. Usar `perfil: "usuario"` para solicitantes comuns.
6. Usar `perfil: "admin"` somente para quem atende e controla chamados.
7. Conferir se `ativo` esta como booleano `true`.
8. Fazer um teste de login com um usuario comum e outro admin antes de divulgar.

## Instalacao do Firebase CLI

Se `firebase --version` nao funcionar, instale o CLI:

```bash
npm install -g firebase-tools
```

Neste projeto o CLI ja foi usado para publicar o site em:

```txt
https://helpdesk-raageplan.web.app
```