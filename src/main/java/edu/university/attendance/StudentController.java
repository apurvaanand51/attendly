package edu.university.attendance;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/students")
public class StudentController {
    private final JdbcTemplate jdbc;
    private final RowMapper<Map<String, Object>> studentMapper =
            (rs, row) -> Map.of("id", rs.getLong("id"), "rollNumber", rs.getString("roll_number"),
                    "name", rs.getString("name"), "department", rs.getString("department"),
                    "email", rs.getString("email"));

    public StudentController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping
    public List<Map<String, Object>> list(@RequestParam(defaultValue = "") String search) {
        String query = "%" + search.trim().toLowerCase() + "%";
        return jdbc.query("""
                SELECT id, roll_number, name, department, email FROM students
                WHERE LOWER(name) LIKE ? OR LOWER(roll_number) LIKE ? OR LOWER(department) LIKE ?
                ORDER BY name
                """, studentMapper, query, query, query);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> create(@RequestBody StudentRequest request) {
        validate(request);
        jdbc.update("INSERT INTO students (roll_number, name, department, email) VALUES (?, ?, ?, ?)",
                request.rollNumber().trim(), request.name().trim(), request.department().trim(),
                request.email() == null ? "" : request.email().trim());
        return jdbc.queryForMap("SELECT id, roll_number AS \"rollNumber\", name, department, email FROM students WHERE roll_number = ?",
                request.rollNumber().trim());
    }

    @PutMapping("/{id}")
    public Map<String, Object> update(@PathVariable long id, @RequestBody StudentRequest request) {
        validate(request);
        int changed = jdbc.update("""
                UPDATE students SET roll_number = ?, name = ?, department = ?, email = ? WHERE id = ?
                """, request.rollNumber().trim(), request.name().trim(), request.department().trim(),
                request.email() == null ? "" : request.email().trim(), id);
        if (changed == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Student not found");
        return jdbc.queryForMap("SELECT id, roll_number AS \"rollNumber\", name, department, email FROM students WHERE id = ?", id);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable long id) {
        jdbc.update("DELETE FROM attendance WHERE student_id = ?", id);
        if (jdbc.update("DELETE FROM students WHERE id = ?", id) == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Student not found");
        }
    }

    private void validate(StudentRequest request) {
        if (request == null || blank(request.rollNumber()) || blank(request.name()) || blank(request.department())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Roll number, student name, and department are required");
        }
    }

    private boolean blank(String value) {
        return value == null || value.isBlank();
    }

    public record StudentRequest(String rollNumber, String name, String department, String email) {}
}
