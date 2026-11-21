package com.supermap.model.flowfield.web;

import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.BindException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {
    private static final Logger LOGGER = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(FlowException.class)
    public ResponseEntity<ApiResponse<Object>> handleFlow(FlowException error) {
        return ResponseEntity.status(error.getStatus())
            .body(ApiResponse.error(error.getStatus().value(), error.getMessage()));
    }

    @ExceptionHandler({MethodArgumentNotValidException.class, BindException.class})
    public ResponseEntity<ApiResponse<Object>> handleValidation(Exception error) {
        String message;
        if (error instanceof MethodArgumentNotValidException) {
            message = ((MethodArgumentNotValidException) error).getBindingResult()
                .getFieldErrors().stream()
                .map(item -> item.getField() + ": " + item.getDefaultMessage())
                .collect(Collectors.joining("; "));
        } else {
            message = error.getMessage();
        }
        return ResponseEntity.badRequest().body(ApiResponse.error(400, message));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Object>> handleUnknown(Exception error) {
        LOGGER.error("Unhandled flow-field error", error);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
            .body(ApiResponse.error(500, "服务内部错误"));
    }
}
