<?php

declare(strict_types=1);

const STORAGE_FILES = [
    'snapshot' => 'state.json',
    'players' => 'players.json',
    'tournaments' => 'tournaments.json',
    'resultCards' => 'resultCards.json',
    'tournamentResults' => 'tournamentResults.json',
    'scoreTables' => 'scoreTables.json',
    'multipliers' => 'multipliers.json',
    'settings' => 'settings.json',
];

const REQUIRED_BASE_STATE_KEYS = [
    'players',
    'tournaments',
    'settings',
    'pointsTable',
    'multipliers',
];

function send_json(int $statusCode, array $payload, array $extraHeaders = []): void
{
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');

    foreach ($extraHeaders as $name => $value) {
        header(sprintf('%s: %s', $name, $value));
    }

    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT) . "\n";
}

function create_default_state(): array
{
    return [
        'version' => 3,
        'players' => [],
        'tournaments' => [],
        'resultCards' => [],
        'settings' => [
            'pdgaPlayerBaseUrl' => 'https://www.pdga.com/player/',
            'pdgaEventBaseUrl' => 'https://www.pdga.com/tour/event/',
        ],
        'pointsTable' => [
            'MPO' => new stdClass(),
            'FPO' => new stdClass(),
        ],
        'multipliers' => [
            [
                'id' => 'multiplier-major',
                'orderNumber' => 1,
                'name' => 'Major',
                'abbreviation' => 'MAJ',
                'multiplier' => 2,
                'createdAt' => '',
                'updatedAt' => '',
            ],
            [
                'id' => 'multiplier-national-tour',
                'orderNumber' => 2,
                'name' => 'National Tour',
                'abbreviation' => 'NT',
                'multiplier' => 1.5,
                'createdAt' => '',
                'updatedAt' => '',
            ],
            [
                'id' => 'multiplier-c-tier',
                'orderNumber' => 3,
                'name' => 'C-Tier',
                'abbreviation' => 'CT',
                'multiplier' => 1,
                'createdAt' => '',
                'updatedAt' => '',
            ],
        ],
    ];
}

function jsondb_directory_path(): string
{
    $configuredPath = trim((string) getenv('SFL_JSONDB_PATH'));
    if ($configuredPath !== '') {
        $documentRoot = rtrim(str_replace('\\', '/', (string) ($_SERVER['DOCUMENT_ROOT'] ?? '')), '/');
        $normalizedConfigured = rtrim(str_replace('\\', '/', $configuredPath), '/');
        $allowPublicPath = strtolower(trim((string) getenv('SFL_ALLOW_PUBLIC_JSONDB'))) === 'true';

        if (
            !$allowPublicPath
            && $documentRoot !== ''
            && (
                $normalizedConfigured === $documentRoot
                || str_starts_with($normalizedConfigured . '/', $documentRoot . '/')
            )
        ) {
            throw new RuntimeException('UNSAFE_JSONDB_PATH');
        }

        return $configuredPath;
    }

    return dirname(__DIR__) . DIRECTORY_SEPARATOR . 'jsondb';
}

function jsondb_file_path(string $fileName): string
{
    return jsondb_directory_path() . DIRECTORY_SEPARATOR . $fileName;
}

function write_json_atomically(string $filePath, $value): void
{
    $encodedValue = json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    if ($encodedValue === false) {
        throw new RuntimeException('FAILED_TO_ENCODE_JSON');
    }

    $directoryPath = dirname($filePath);
    $tempFilePath = $directoryPath . DIRECTORY_SEPARATOR . sprintf(
        '.tmp-%s-%s-%s',
        getmypid(),
        bin2hex(random_bytes(6)),
        basename($filePath)
    );

    $payload = $encodedValue . "\n";
    if (file_put_contents($tempFilePath, $payload, LOCK_EX) === false) {
        throw new RuntimeException('FAILED_TO_WRITE_FILE');
    }

    if (!rename($tempFilePath, $filePath)) {
        @unlink($tempFilePath);
        throw new RuntimeException('FAILED_TO_RENAME_FILE');
    }
}

function write_json_atomically_if_changed(string $filePath, $value): void
{
    $encodedValue = json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    if ($encodedValue === false) {
        throw new RuntimeException('FAILED_TO_ENCODE_JSON');
    }

    $payload = $encodedValue . "\n";
    if (is_file($filePath)) {
        $existing = file_get_contents($filePath);
        if ($existing === false) {
            throw new RuntimeException('FAILED_TO_READ_FILE');
        }

        if ($existing === $payload) {
            return;
        }
    }

    write_json_atomically($filePath, $value);
}

function read_json_file(string $filePath, $fallback)
{
    if (!is_file($filePath)) {
        return $fallback;
    }

    $contents = file_get_contents($filePath);
    if ($contents === false) {
        throw new RuntimeException('FAILED_TO_READ_FILE');
    }

    try {
        return json_decode($contents, true, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException $exception) {
        throw new RuntimeException('INVALID_JSON_FILE', 0, $exception);
    }
}

function read_json_file_if_exists(string $filePath)
{
    if (!is_file($filePath)) {
        return null;
    }

    $contents = file_get_contents($filePath);
    if ($contents === false) {
        throw new RuntimeException('FAILED_TO_READ_FILE');
    }

    try {
        return json_decode($contents, true, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException $exception) {
        throw new RuntimeException('INVALID_JSON_FILE', 0, $exception);
    }
}

function ensure_jsondb_directory(): void
{
    $directoryPath = jsondb_directory_path();
    if (!is_dir($directoryPath) && !mkdir($directoryPath, 0775, true) && !is_dir($directoryPath)) {
        throw new RuntimeException('FAILED_TO_CREATE_DIRECTORY');
    }

    $denyAccessHtaccess = $directoryPath . DIRECTORY_SEPARATOR . '.htaccess';
    $denyAccessRules = "Deny from all\n<IfModule mod_authz_core.c>\n  Require all denied\n</IfModule>\n";
    $currentRules = is_file($denyAccessHtaccess) ? file_get_contents($denyAccessHtaccess) : false;
    if ($currentRules === false || $currentRules !== $denyAccessRules) {
        if (file_put_contents($denyAccessHtaccess, $denyAccessRules, LOCK_EX) === false) {
            throw new RuntimeException('FAILED_TO_WRITE_HTACCESS');
        }
    }

    if (!is_file($denyAccessHtaccess)) {
        throw new RuntimeException('FAILED_TO_WRITE_HTACCESS');
    }
}

function normalize_state_payload(array $payload): array
{
    $defaultState = create_default_state();

    if (!array_key_exists('pointsTable', $payload) && array_key_exists('scoreTables', $payload)) {
        $payload['pointsTable'] = $payload['scoreTables'];
    }

    foreach (REQUIRED_BASE_STATE_KEYS as $requiredKey) {
        if (!array_key_exists($requiredKey, $payload)) {
            throw new InvalidArgumentException('INCOMPLETE_STATE_PAYLOAD');
        }
    }

    if (!array_key_exists('resultCards', $payload)) {
        if (array_key_exists('tournamentResults', $payload)) {
            $payload['resultCards'] = $payload['tournamentResults'];
        } else {
            throw new InvalidArgumentException('INCOMPLETE_STATE_PAYLOAD');
        }
    }

    if (!is_array($payload['resultCards']) || !array_is_list($payload['resultCards'])) {
        throw new InvalidArgumentException('INVALID_STATE_PAYLOAD');
    }

    $payload['settings'] = is_array($payload['settings'])
        ? array_replace($defaultState['settings'], $payload['settings'])
        : $defaultState['settings'];

    $payloadPointsTable = is_array($payload['pointsTable']) ? $payload['pointsTable'] : [];
    $payload['pointsTable'] = [
        'MPO' => is_array($payloadPointsTable['MPO'] ?? null) ? $payloadPointsTable['MPO'] : [],
        'FPO' => is_array($payloadPointsTable['FPO'] ?? null) ? $payloadPointsTable['FPO'] : [],
    ];

    return $payload;
}

function sync_state_slices(array $state): void
{
    write_json_atomically_if_changed(jsondb_file_path(STORAGE_FILES['players']), $state['players'] ?? []);
    write_json_atomically_if_changed(jsondb_file_path(STORAGE_FILES['tournaments']), $state['tournaments'] ?? []);

    $resultCards = $state['resultCards'] ?? $state['tournamentResults'] ?? [];
    write_json_atomically_if_changed(jsondb_file_path(STORAGE_FILES['resultCards']), $resultCards);
    write_json_atomically_if_changed(jsondb_file_path(STORAGE_FILES['tournamentResults']), $resultCards);

    write_json_atomically_if_changed(
        jsondb_file_path(STORAGE_FILES['scoreTables']),
        $state['pointsTable'] ?? ['MPO' => new stdClass(), 'FPO' => new stdClass()]
    );
    write_json_atomically_if_changed(jsondb_file_path(STORAGE_FILES['multipliers']), $state['multipliers'] ?? []);
    write_json_atomically_if_changed(jsondb_file_path(STORAGE_FILES['settings']), $state['settings'] ?? []);
}

function load_state(): array
{
    ensure_jsondb_directory();
    $stateFromSlices = create_default_state();
    $stateFromSlices['players'] = read_json_file(jsondb_file_path(STORAGE_FILES['players']), $stateFromSlices['players']);
    $stateFromSlices['tournaments'] = read_json_file(
        jsondb_file_path(STORAGE_FILES['tournaments']),
        $stateFromSlices['tournaments']
    );
    $stateFromSlices['settings'] = read_json_file(jsondb_file_path(STORAGE_FILES['settings']), $stateFromSlices['settings']);
    $stateFromSlices['multipliers'] = read_json_file(
        jsondb_file_path(STORAGE_FILES['multipliers']),
        $stateFromSlices['multipliers']
    );
    $stateFromSlices['pointsTable'] = read_json_file(
        jsondb_file_path(STORAGE_FILES['scoreTables']),
        $stateFromSlices['pointsTable']
    );

    $resultCards = read_json_file_if_exists(jsondb_file_path(STORAGE_FILES['resultCards']));
    if (!is_array($resultCards) || !array_is_list($resultCards)) {
        $resultCards = read_json_file(jsondb_file_path(STORAGE_FILES['tournamentResults']), $stateFromSlices['resultCards']);
        if (!is_array($resultCards) || !array_is_list($resultCards)) {
            $resultCards = $stateFromSlices['resultCards'];
        }
    }
    $stateFromSlices['resultCards'] = $resultCards;

    $snapshot = read_json_file_if_exists(jsondb_file_path(STORAGE_FILES['snapshot']));
    if (!is_array($snapshot) || array_is_list($snapshot)) {
        $snapshot = [];
    }

    $state = normalize_state_payload(array_replace($stateFromSlices, $snapshot));
    write_json_atomically_if_changed(jsondb_file_path(STORAGE_FILES['snapshot']), $state);
    sync_state_slices($state);

    return $state;
}

function save_state(array $state): array
{
    ensure_jsondb_directory();
    $normalizedState = normalize_state_payload($state);

    write_json_atomically(jsondb_file_path(STORAGE_FILES['snapshot']), $normalizedState);
    sync_state_slices($normalizedState);

    return $normalizedState;
}

function read_request_json_payload(): array
{
    $rawBody = (string) file_get_contents('php://input');
    if (trim($rawBody) === '') {
        return [];
    }

    try {
        $decodedBody = json_decode($rawBody, true, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException $exception) {
        throw new InvalidArgumentException('INVALID_JSON');
    }

    if (!is_array($decodedBody) || array_is_list($decodedBody)) {
        throw new InvalidArgumentException('INVALID_STATE_PAYLOAD');
    }

    return $decodedBody;
}

function handle_health_endpoint(string $method): void
{
    if ($method !== 'GET') {
        send_json(405, ['message' => 'Metodia ei tueta.'], ['Allow' => 'GET']);
        return;
    }

    send_json(200, ['status' => 'ok']);
}

function handle_state_endpoint(string $method): void
{
    if ($method === 'GET') {
        send_json(200, load_state());
        return;
    }

    if ($method === 'PUT') {
        send_json(200, save_state(read_request_json_payload()));
        return;
    }

    send_json(405, ['message' => 'Metodia ei tueta.'], ['Allow' => 'GET, PUT']);
}

try {
    $endpoint = strtolower(trim((string) ($_GET['endpoint'] ?? ''), '/'));
    $method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));

    if ($endpoint === 'health') {
        handle_health_endpoint($method);
        return;
    }

    if ($endpoint === 'state') {
        handle_state_endpoint($method);
        return;
    }

    send_json(404, ['message' => 'Rajapintaa ei löytynyt.']);
} catch (InvalidArgumentException $error) {
    if ($error->getMessage() === 'INVALID_JSON') {
        send_json(400, ['message' => 'Pyynnön JSON-data on virheellinen.']);
        return;
    }

    if ($error->getMessage() === 'INCOMPLETE_STATE_PAYLOAD') {
        send_json(400, ['message' => 'Tallennettava tila on puutteellinen. Lähetä koko sovelluksen tila yhdessä pyynnössä.']);
        return;
    }

    if ($error->getMessage() === 'INVALID_STATE_PAYLOAD') {
        send_json(400, ['message' => 'Tallennettava tila pitää lähettää JSON-objektina.']);
        return;
    }

    send_json(400, ['message' => 'Tallennettava tila on puutteellinen. Lähetä koko sovelluksen tila yhdessä pyynnössä.']);
} catch (Throwable $error) {
    if ($error->getMessage() === 'UNSAFE_JSONDB_PATH') {
        send_json(500, ['message' => 'Palvelimen tallennushakemistoa ei ole määritetty turvallisesti.']);
        return;
    }

    send_json(500, ['message' => 'Palvelimella tapahtui virhe tallennuksen aikana.']);
}
