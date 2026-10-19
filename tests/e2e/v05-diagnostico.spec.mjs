// v0.5.0: diagnosis of one photo with guidance (decisions 0011 and 0013):
// verdict, light of the scene, findings with advice, "why" (source and
// certainty), what was possible with that light and what was missing.
import { test, expect } from '@playwright/test';
import { join } from 'node:path';

const FIX = join(process.cwd(), 'tests', 'fixtures', 'generated');
const fx = (...names) => names.map((n) => join(FIX, n));

async function uploadAndSettle(page, files) {
  await page.goto('#/enviar');
  await page.getByTestId('input-files').setInputFiles(files);
  await expect(page.getByTestId('queue-summary')).not.toContainText('andamento', { timeout: 60_000 });
}

async function openPhoto(page, name) {
  await page.goto('#/fotos');
  await page.getByTestId('photo-card').filter({ hasText: name }).click();
  await expect(page.getByTestId('diagnosis')).toBeVisible();
  await expect(page.getByTestId('analysing')).toHaveCount(0, { timeout: 30_000 });
}

const finding = (page, key) => page.locator(`[data-testid="diag-finding"][data-key="${key}"]`);

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (e) => { throw e; });
});

test('ficha: diagnóstico no topo, luz pelo fotômetro e o que dava para fazer com essa luz', async ({ page }) => {
  await uploadAndSettle(page, fx('IMG_0001.JPG'));
  await openPhoto(page, 'IMG_0001');
  const card = page.getByTestId('diagnosis');
  // First card of the information column.
  await expect(page.locator('.sheet-info > section').first()).toHaveAttribute('data-testid', 'diagnosis');
  await expect(page.getByTestId('diag-verdict')).toHaveText(/Boa|Aceitável|Com problema|Sem dados para julgar/);
  await expect(page.getByTestId('diag-light')).toContainText('EV 9,5');
  await expect(page.getByTestId('diag-light')).toContainText('fotômetro da câmera');
  const possible = page.getByTestId('diag-possible');
  await expect(possible).toContainText(/Você usou\s*1\/250\s+s · f\/1,8 · ISO 400/);
  // EV 9,5 at 50 mm: 1/100 s (2× margin over 1/50) at f/2,8 (RF 50 general rule) needs ISO 125.
  await expect(possible).toContainText(/À mão, sem tremido\s*1\/100\s+s · f\/2,8 · ISO 125/);
  await expect(possible).toContainText('Abertura máxima a 50 mm: f/1,8 (gravada pela câmera)');
  await expect(card).toContainText('Sem inteligência artificial');
});

test('foto lenta (1/15 s a 50 mm): achado de tremido com o número, a origem e a certeza', async ({ page }) => {
  await uploadAndSettle(page, fx('IMG_0010.JPG'));
  await openPhoto(page, 'IMG_0010');
  const shake = finding(page, 'shake');
  await expect(shake).toContainText('1/15 s é 3,3× mais lenta que a referência 1/50 s');
  await expect(shake.getByTestId('diag-advice')).toContainText('Na próxima:');
  await shake.locator('summary').click();
  await expect(shake.getByTestId('diag-sources')).toContainText('física da exposição');
  await expect(shake.getByTestId('diag-sources')).toContainText('regra geral');
  await expect(shake).toContainText(/certeza (alta|média|baixa)/);
  await expect(shake).toContainText('Rodada 2');
  // S2 chosen in the camera: a note to record in L.
  await expect(finding(page, 'small_size')).toContainText('grave em L');
});

test('céu estourado: alerta com a porcentagem e a compensação, também na grade', async ({ page }) => {
  await uploadAndSettle(page, fx('IMG_0020_ceu.JPG'));
  await openPhoto(page, 'IMG_0020');
  await expect(page.getByTestId('diag-headline')).toHaveText('Altas luzes estouradas');
  await expect(page.getByTestId('diag-verdict')).toHaveText('Com problema');
  const hi = finding(page, 'highlights');
  await expect(hi).toContainText(/(39|40|41)% da foto/);
  await expect(hi.getByTestId('diag-advice')).toContainText('Compense −1 EV');
  await page.goto('#/fotos');
  await expect(page.getByTestId('diag-chip')).toHaveText('Altas luzes estouradas');
  await expect(page.getByTestId('diag-chip')).toHaveAttribute('data-verdict', 'problem');
});

test('sem MakerNote: luz pela exposição e a lista do que faltou (regra 5)', async ({ page }) => {
  await uploadAndSettle(page, fx('IMG_0002_sem_makernote.JPG'));
  await openPhoto(page, 'IMG_0002');
  await expect(page.getByTestId('diag-light')).toContainText('pela exposição usada, descontada a compensação de −1/3 EV');
  const missing = page.getByTestId('diag-missing');
  await expect(missing).toContainText('O que faltou para diagnosticar');
  await expect(missing).toContainText('Ponto de AF não gravado neste arquivo');
});

test('tela Avaliar mostra a mesma luz da ficha (fotômetro)', async ({ page }) => {
  await uploadAndSettle(page, fx('IMG_0001.JPG'));
  await page.goto('#/avaliar/todas');
  await expect(page.getByTestId('rate-scene-light')).toContainText('Luz da cena: EV 9,5');
  await expect(page.getByTestId('rate-scene-light')).toContainText('fotômetro');
});

test('v2.0.1: "Medidas desta foto" sempre aparece, com o número, a escala e o "Discorda?"', async ({ page }) => {
  await uploadAndSettle(page, fx('IMG_0001.JPG'));
  await openPhoto(page, 'IMG_0001');
  const m = page.getByTestId('diag-measures');
  await expect(m).toContainText('Medidas desta foto');
  await expect(m.locator('tr[data-key="af_blur"]')).toContainText(/Desfoque no ponto de foco\s*\d,\d\d/);
  await expect(m.locator('tr[data-key="af_blur"]')).toContainText('tripé 0,27');
  await expect(m.locator('tr[data-key="af_source"]')).toContainText('ponto de AF gravado pela câmera');
  await expect(m.locator('tr[data-key="shake"]')).toContainText('1/250 s para a referência 1/50 s: folga de 5,0×');
  await expect(m.locator('tr[data-key="iso"]')).toContainText('ISO 400');
  await m.getByTestId('diag-disagree').click();
  await expect(page).toHaveURL(/#\/avaliar\/[^/]+\/[^/]+$/);
});
