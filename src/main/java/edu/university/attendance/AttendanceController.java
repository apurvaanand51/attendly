package edu.university.attendance;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class AttendanceController {
    private final JdbcTemplate jdbc;

    public AttendanceController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping("/attendance")
    public List<Map<String, Object>> attendance(
            @RequestParam(required = false) String date,
            @RequestParam(required = false) String subject) {
        LocalDate attendanceDate = date == null || date.isBlank() ? LocalDate.now() : LocalDate.parse(date);
        String subjectFilter = subject == null ? "" : subject.trim();
        return jdbc.queryForList("""
                SELECT a.id AS "id", a.student_id AS "studentId", s.roll_number AS "rollNumber",
                       s.name AS "name", a.subject AS "subject", a.attendance_date AS "date",
                       a.status AS "status"
                FROM attendance a JOIN students s ON s.id = a.student_id
                WHERE a.attendance_date = ? AND (? = '' OR LOWER(a.subject) LIKE LOWER(?))
                ORDER BY s.name, a.subject
                """, attendanceDate, subjectFilter, "%" + subjectFilter + "%");
    }

    @PostMapping("/attendance")
    @ResponseStatus(HttpStatus.OK)
    public Map<String, Object> mark(@RequestBody AttendanceRequest request) {
        if (request == null || request.studentId() == null || request.subject() == null ||
                request.subject().isBlank() || request.date() == null ||
                request.status() == null || !List.of("PRESENT", "ABSENT").contains(request.status())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Student, subject, date, and a valid attendance status are required");
        }
        if (jdbc.queryForObject("SELECT COUNT(*) FROM students WHERE id = ?", Integer.class, request.studentId()) == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Student not found");
        }
        List<Long> existing = jdbc.query("SELECT id FROM attendance WHERE student_id = ? AND subject = ? AND attendance_date = ?",
                (rs, row) -> rs.getLong(1), request.studentId(), request.subject().trim(), request.date());
        if (existing.isEmpty()) {
            jdbc.update("""
                    INSERT INTO attendance (student_id, subject, attendance_date, status) VALUES (?, ?, ?, ?)
                    """, request.studentId(), request.subject().trim(), request.date(), request.status());
        } else {
            jdbc.update("UPDATE attendance SET status = ? WHERE id = ?", request.status(), existing.get(0));
        }
        return Map.of("saved", true);
    }

    @GetMapping("/reports")
    public List<Map<String, Object>> reports(@RequestParam(defaultValue = "") String subject,
                                              @RequestParam(defaultValue = "false") boolean belowThreshold,
                                              @RequestParam(defaultValue = "") String search) {
        return jdbc.queryForList("""
                SELECT s.id AS "studentId", s.roll_number AS "rollNumber",
                       s.name AS "name", a.subject AS "subject", COUNT(*) AS "classesHeld",
                       SUM(CASE WHEN a.status = 'PRESENT' THEN 1 ELSE 0 END) AS "classesAttended",
                       ROUND(100.0 * SUM(CASE WHEN a.status = 'PRESENT' THEN 1 ELSE 0 END) / COUNT(*), 1) AS "percentage"
                FROM students s JOIN attendance a ON a.student_id = s.id
                WHERE (? = '' OR LOWER(a.subject) LIKE LOWER(?))
                  AND (? = '' OR LOWER(s.name) LIKE LOWER(?) OR LOWER(s.roll_number) LIKE LOWER(?))
                GROUP BY s.id, s.roll_number, s.name, a.subject
                HAVING (? = FALSE OR 100.0 * SUM(CASE WHEN a.status = 'PRESENT' THEN 1 ELSE 0 END) / COUNT(*) < 75)
                ORDER BY "percentage", s.name
                """, subject.trim(), "%" + subject.trim() + "%", search.trim(), "%" + search.trim() + "%",
                "%" + search.trim() + "%", belowThreshold);
    }

    @GetMapping("/subjects")
    public List<String> subjects() {
        return jdbc.queryForList("SELECT DISTINCT subject FROM attendance ORDER BY subject", String.class);
    }

    public record AttendanceRequest(Long studentId, String subject, LocalDate date, String status) {}
}
