<?php
use PHPUnit\Framework\TestCase;

class FunctionsTest extends TestCase
{
    protected function setUp(): void
    {
        set_error_handler(null);
        set_exception_handler(null);
    }

    public function testExtractVideoIdValid()
    {
        $url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
        $this->assertSame('dQw4w9WgXcQ', extract_video_id($url));
    }

    public function testExtractVideoIdInvalid()
    {
        $this->assertFalse(extract_video_id('not a url'));
    }

    public function testCreateTables()
    {
        $db = new SQLite3(':memory:');
        createTables($db);
        $tables = ['profiles','options','queue','downloaded','directories'];
        foreach ($tables as $table) {
            $exists = $db->querySingle("SELECT name FROM sqlite_master WHERE type='table' AND name='$table'");
            $this->assertSame($table, $exists);
        }
    }

    public function testCreateTablesAddsDestPath()
    {
        $db = new SQLite3(':memory:');
        // simulate older schema without dest_path
        $db->exec("CREATE TABLE profiles (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)");
        createTables($db);
        $cols = [];
        $result = $db->query('PRAGMA table_info(profiles)');
        while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
            $cols[] = $row['name'];
        }
        $this->assertContains('dest_path', $cols);
    }

    public function testDetermineQualityMin()
    {
        $profile = ['min_res' => '720'];
        $expected = '-f "bv*[height>=720]+ba/b[height>=720] / wv*+ba/w"';
        $this->assertSame($expected, determineQuality($profile));
    }

    public function testDetermineQualityMax()
    {
        $profile = ['max_res' => '480'];
        $expected = '-f "bv*[height<=480]+ba/b[height<=480] / wv*+ba/w"';
        $this->assertSame($expected, determineQuality($profile));
    }

    public function testDetermineQualityDefault()
    {
        $profile = [];
        $expected = '-f "bv*[height<=1080]+ba/b[height<=1080] / wv*+ba/w"';
        $this->assertSame($expected, determineQuality($profile));
    }
    public function testApplyRenameRulesMultipleLines()
    {
        $filename = 'My Video File.mp4';
        $rules = "/\\s+/||_\n/Video/||Clip";
        $result = applyRenameRules($filename, $rules);
        $this->assertSame('My_Clip_File.mp4', $result['filename']);
        $this->assertNull($result['error']);
    }

    public function testApplyRenameRulesInvalidRegex()
    {
        $filename = 'test.mp4';
        $rules = '/foo(/||bar';
        $result = applyRenameRules($filename, $rules);
        $this->assertSame('test.mp4', $result['filename']);
        $this->assertStringContainsString('Invalid rename regex', $result['error']);
    }

    public function testApplyRenameRulesMatchesOldLoop()
    {
        $filename = 'Another Video.mp4';
        $rules = "/\\s+/||_\n/Video/||Clip";

        $base = basename($filename);
        $expressions = preg_split('/\r?\n/', $rules, -1, PREG_SPLIT_NO_EMPTY);
        foreach ($expressions as $expr) {
            $expr = rtrim($expr, "\r\n");
            if ($expr === '') {
                continue;
            }
            $pattern = $expr;
            $replacement = '';
            if (strpos($expr, '||') !== false) {
                list($pattern, $replacement) = explode('||', $expr, 2);
            }
            $pattern = trim($pattern);
            $resultLoop = preg_replace($pattern, $replacement, $base);
            if ($resultLoop !== null) {
                $base = $resultLoop;
            }
        }

        $expected = $base;

        $result = applyRenameRules('Another Video.mp4', $rules);
        $this->assertSame($expected, $result['filename']);
        $this->assertNull($result['error']);
    }

}
