output "endpoint_url" {
  value = aws_lambda_function_url.il_test_url_endpoint.function_url
}

output "lambda_arn" {
  value = aws_lambda_function.il_test_url_function.arn
}
