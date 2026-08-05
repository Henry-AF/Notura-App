/**
 * Ponte entre o Linear e os workflows de dispatch (NOT-163 v2).
 *
 * O Notura-App nao usa issues do GitHub -- o rastreamento inteiro vive no
 * Linear. Este script busca a issue pela chave (ex.: NOT-164) para virar prompt
 * do agente, e devolve o resultado como comentario na propria issue.
 *
 * Sem dependencias: usa fetch nativo do Node 24.
 *
 * Uso:
 *   node linear-dispatch.mjs fetch  NOT-164 <arquivo-de-saida>
 *   node linear-dispatch.mjs comment NOT-164 <arquivo-com-o-corpo>
 *   node linear-dispatch.mjs label   NOT-164 "dispatch:codex"
 */

import { writeFileSync, readFileSync, appendFileSync } from 'node:fs';

const ENDPOINT = 'https://api.linear.app/graphql';

const API_KEY = process.env.LINEAR_API_KEY;
if (!API_KEY) {
  console.error('LINEAR_API_KEY nao definida. Configure em Settings > Secrets > Actions.');
  process.exit(1);
}

async function gql(query, variables = {}) {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    // Personal API keys do Linear vao cruas no Authorization, sem "Bearer".
    headers: { Authorization: API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`Linear respondeu ${response.status}: ${(await response.text()).slice(0, 400)}`);
  }

  const payload = await response.json();
  if (payload.errors?.length) {
    throw new Error(`Linear retornou erro GraphQL: ${payload.errors.map((e) => e.message).join('; ')}`);
  }
  return payload.data;
}

/** "NOT-164" -> { teamKey: "NOT", number: 164 } */
function parseKey(issueKey) {
  const match = /^([A-Z]+)-(\d+)$/.exec(issueKey.trim().toUpperCase());
  if (!match) {
    throw new Error(`Chave de issue invalida: "${issueKey}". Esperado algo como NOT-164.`);
  }
  return { teamKey: match[1], number: Number(match[2]) };
}

async function findIssue(issueKey) {
  const { teamKey, number } = parseKey(issueKey);
  const data = await gql(
    `query Issue($teamKey: String!, $number: Float!) {
      issues(first: 1, filter: { team: { key: { eq: $teamKey } }, number: { eq: $number } }) {
        nodes {
          id
          identifier
          title
          description
          url
          state { name }
          team { id }
          labels(first: 20) { nodes { id name } }
        }
      }
    }`,
    { teamKey, number },
  );

  const issue = data.issues.nodes[0];
  if (!issue) throw new Error(`Issue ${issueKey} nao encontrada no Linear.`);
  return issue;
}

/** Grava saidas para os proximos steps do workflow. */
function setOutput(name, value) {
  if (!process.env.GITHUB_OUTPUT) return;
  // Delimitador aleatorio: titulos podem conter qualquer coisa, inclusive quebras de linha.
  const delimiter = `ghadelim_${Math.random().toString(36).slice(2)}`;
  appendFileSync(process.env.GITHUB_OUTPUT, `${name}<<${delimiter}\n${value}\n${delimiter}\n`);
}

async function commandFetch(issueKey, outputPath) {
  const issue = await findIssue(issueKey);

  const body = [
    `# ${issue.identifier}: ${issue.title}`,
    '',
    `Status atual no Linear: ${issue.state.name}`,
    `URL: ${issue.url}`,
    '',
    '## Descricao da issue',
    '',
    issue.description?.trim() || '_(a issue nao tem descricao)_',
  ].join('\n');

  writeFileSync(outputPath, body, 'utf8');

  setOutput('identifier', issue.identifier);
  setOutput('title', issue.title);
  setOutput('url', issue.url);
  setOutput('slug', issue.identifier.toLowerCase());

  console.log(`Issue ${issue.identifier} carregada (${body.length} caracteres de prompt).`);
}

async function commandComment(issueKey, bodyPath) {
  const issue = await findIssue(issueKey);
  const body = readFileSync(bodyPath, 'utf8');

  const data = await gql(
    `mutation Comment($input: CommentCreateInput!) {
      commentCreate(input: $input) { success }
    }`,
    { input: { issueId: issue.id, body } },
  );

  if (!data.commentCreate.success) throw new Error('Linear recusou a criacao do comentario.');
  console.log(`Comentario publicado em ${issue.identifier}.`);
}

async function commandLabel(issueKey, labelName) {
  const issue = await findIssue(issueKey);

  if (issue.labels.nodes.some((label) => label.name === labelName)) {
    console.log(`${issue.identifier} ja tem o label "${labelName}".`);
    return;
  }

  const existing = await gql(
    `query Labels($name: String!) {
      issueLabels(first: 10, filter: { name: { eq: $name } }) {
        nodes { id name team { id } }
      }
    }`,
    { name: labelName },
  );

  let label = existing.issueLabels.nodes.find(
    (candidate) => candidate.team === null || candidate.team.id === issue.team.id,
  );

  if (!label) {
    const created = await gql(
      `mutation CreateLabel($input: IssueLabelCreateInput!) {
        issueLabelCreate(input: $input) { success issueLabel { id name } }
      }`,
      {
        input: {
          name: labelName,
          color: labelName.includes('codex') ? '#10a37f' : '#d97757',
          description: 'Issue despachada para um agente de codigo via GitHub Actions (NOT-163 v2).',
          teamId: issue.team.id,
        },
      },
    );
    if (!created.issueLabelCreate.success) throw new Error(`Nao consegui criar o label "${labelName}".`);
    label = created.issueLabelCreate.issueLabel;
    console.log(`Label "${labelName}" criado.`);
  }

  // labelIds substitui a lista inteira -- precisa reenviar os que ja existem.
  const labelIds = [...issue.labels.nodes.map((l) => l.id), label.id];
  const updated = await gql(
    `mutation UpdateIssue($id: String!, $labelIds: [String!]!) {
      issueUpdate(id: $id, input: { labelIds: $labelIds }) { success }
    }`,
    { id: issue.id, labelIds },
  );

  if (!updated.issueUpdate.success) throw new Error(`Linear recusou aplicar o label em ${issue.identifier}.`);
  console.log(`Label "${labelName}" aplicado em ${issue.identifier}.`);
}

const [command, issueKey, argument] = process.argv.slice(2);

const commands = {
  fetch: () => commandFetch(issueKey, argument),
  comment: () => commandComment(issueKey, argument),
  label: () => commandLabel(issueKey, argument),
};

if (!commands[command]) {
  console.error(`Comando desconhecido: "${command}". Use fetch, comment ou label.`);
  process.exit(1);
}

commands[command]().catch((error) => {
  console.error(`[linear-dispatch] ${error.message}`);
  process.exitCode = 1;
});
